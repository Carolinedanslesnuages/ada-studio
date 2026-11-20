import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { lireConfig } from '../config.js';
import type { AgentService } from '../agent/agent.service.js';
import type { GithubService } from '../github/github.service.js';
import type { StoriesService } from '../stories/stories.service.js';
import type { ProjetsService } from './projets.service.js';
import { RepriseService, texteDemandeAnalyse } from './reprise.service.js';

const config = lireConfig({ GITHUB_PROPRIETAIRE: 'proprio', GITHUB_CLIENT_ID: 'Iv', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: 'x'.repeat(32) });
const depot = (name: string, owner: string, topics: string[] = [], extra: object = {}) => ({
  name,
  owner: { login: owner },
  topics,
  default_branch: 'main',
  archived: false,
  permissions: { push: true, admin: true },
  description: null,
  private: true,
  html_url: `https://github.com/${owner}/${name}`,
  ...extra,
});

describe('RepriseService (#37)', () => {
  const gh = {
    repos: { get: vi.fn(), replaceAllTopics: vi.fn(), getContent: vi.fn() },
    pulls: { list: vi.fn(), get: vi.fn(), merge: vi.fn(), update: vi.fn() },
    git: { deleteRef: vi.fn() },
    issues: { createComment: vi.fn(), update: vi.fn(), listForRepo: vi.fn() },
    paginate: vi.fn(),
    checks: { listForRef: vi.fn() },
  };
  const github = { client: vi.fn(() => gh) } as unknown as GithubService;
  const projets = {
    depotsAccessibles: vi.fn(),
    lister: vi.fn(),
    poserLabels: vi.fn(),
    aLeTopic: (d: { topics?: string[] }, ...topics: string[]) => (d.topics ?? []).some((topic) => topics.includes(topic)),
    modeles: () => ({ modeles: [{ id: 'vue-node', libelle: 'Vue + Node', disponible: true }, { id: 'pas-pret', libelle: 'X', disponible: false }] }),
  };
  const stories = { prompter: vi.fn() };
  const agent = { verifierDisponible: vi.fn(), verrouActif: vi.fn(), analyserReprise: vi.fn() };
  let service: RepriseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RepriseService(config, github, projets as unknown as ProjetsService, stories as unknown as StoriesService, agent as unknown as AgentService);
    gh.repos.get.mockResolvedValue({ data: depot('mon-poc', 'un-po', ['vue']) });
    gh.repos.replaceAllTopics.mockResolvedValue({});
    gh.pulls.list.mockResolvedValue({ data: [] });
    stories.prompter.mockResolvedValue({ numero: 7 });
    agent.verrouActif.mockResolvedValue(null);
    agent.analyserReprise.mockResolvedValue(undefined);
  });

  it('liste les dépôts pas encore dans ADA, avec l’état de leur reprise (analyse en cours, PR à fusionner)', async () => {
    projets.depotsAccessibles.mockResolvedValue([
      depot('deja', 'proprio', ['ada-studio']),
      depot('commun', 'proprio'),
      depot('archive', 'proprio', [], { archived: true }),
      depot('lecture-seule', 'proprio', [], { permissions: { push: false } }),
      depot('en-analyse', 'Un-PO', ['ada-studio-reprise']),
      depot('mon-poc', 'Un-PO', ['ada-studio-reprise']),
    ]);
    projets.lister.mockResolvedValue([{ id: 'deja' }]);
    gh.pulls.list.mockImplementation(async ({ repo }: { repo: string }) => ({ data: repo === 'mon-poc' ? [{ html_url: 'https://github.com/Un-PO/mon-poc/pull/3' }] : [] }));
    agent.verrouActif.mockImplementation(async (id: string) => (id === 'un-po~en-analyse' ? { pid: 1 } : null));
    expect(await service.lister('jeton', 'un-po')).toEqual([
      expect.objectContaining({ id: 'commun', compte: 'organisation', repriseEnCours: null, analyseEnCours: false }),
      expect.objectContaining({ id: 'un-po~en-analyse', compte: 'personnel', repriseEnCours: null, analyseEnCours: true }),
      expect.objectContaining({ id: 'un-po~mon-poc', repriseEnCours: 'https://github.com/Un-PO/mon-poc/pull/3', analyseEnCours: false }),
    ]);
  });

  it('sans stack : marque le dépôt, enregistre la demande d’analyse au nom du PO et lance ADA', async () => {
    const resultat = await service.reprendre('jeton', 'un-po', { depot: 'un-po~mon-poc' });
    expect(gh.repos.replaceAllTopics).toHaveBeenCalledWith({ owner: 'un-po', repo: 'mon-poc', names: ['vue', 'ada-studio-reprise'] });
    expect(projets.poserLabels).toHaveBeenCalledWith(gh, 'un-po', 'mon-poc');
    expect(stories.prompter).toHaveBeenCalledWith('jeton', 'un-po~mon-poc', expect.stringContaining('comme s’il avait été créé avec ADA'), 'un-po');
    expect(agent.analyserReprise).toHaveBeenCalledWith('jeton', 'un-po~mon-poc', 7, 'un-po', { modele: null });
    expect(resultat).toEqual({ id: 'un-po~mon-poc', analyse: 'https://github.com/un-po/mon-poc/issues/7', pullRequest: null });
  });

  it('avec une stack : transmise à l’analyse', async () => {
    await service.reprendre('jeton', 'un-po', { depot: 'mon-poc', modele: 'vue-node' });
    expect(stories.prompter).toHaveBeenCalledWith('jeton', 'mon-poc', expect.stringContaining('Vue + Node'), 'un-po');
    expect(agent.analyserReprise).toHaveBeenCalledWith('jeton', 'mon-poc', 7, 'un-po', { modele: 'vue-node' });
  });

  it('une reprise déjà proposée renvoie sa PR, sans nouvelle analyse', async () => {
    gh.pulls.list.mockResolvedValue({ data: [{ html_url: 'https://github.com/un-po/mon-poc/pull/3' }] });
    expect(await service.reprendre('jeton', 'un-po', { depot: 'un-po~mon-poc' })).toEqual({ id: 'un-po~mon-poc', analyse: null, pullRequest: 'https://github.com/un-po/mon-poc/pull/3' });
    expect(agent.analyserReprise).not.toHaveBeenCalled();
  });

  it('refuse : autre compte, stack indisponible, déjà dans ADA, branche autre que main, analyse déjà en cours', async () => {
    await expect(service.reprendre('jeton', 'un-po', { depot: 'autre~poc' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reprendre('jeton', 'un-po', { depot: 'poc', modele: 'pas-pret' })).rejects.toBeInstanceOf(BadRequestException);
    gh.repos.get.mockResolvedValueOnce({ data: depot('poc', 'proprio', ['ada-studio']) });
    await expect(service.reprendre('jeton', 'un-po', { depot: 'poc' })).rejects.toBeInstanceOf(ConflictException);
    gh.repos.get.mockResolvedValueOnce({ data: depot('poc', 'proprio', [], { default_branch: 'master' }) });
    await expect(service.reprendre('jeton', 'un-po', { depot: 'poc' })).rejects.toThrow(/master/);
    agent.verrouActif.mockResolvedValueOnce({ pid: 1 });
    await expect(service.reprendre('jeton', 'un-po', { depot: 'poc' })).rejects.toThrow(/analyse déjà/);
    expect(agent.analyserReprise).not.toHaveBeenCalled();
  });

  it('explique qu’il faut un administrateur quand GitHub refuse de marquer le dépôt', async () => {
    gh.repos.replaceAllTopics.mockRejectedValue(Object.assign(new Error('interdit'), { status: 403 }));
    await expect(service.reprendre('jeton', 'un-po', { depot: 'poc' })).rejects.toThrow(/administrateur/);
    expect(stories.prompter).not.toHaveBeenCalled();
  });

  describe('suivi et validation de la reprise depuis ADA', () => {
    const prOuverte = (titre = 'chore: reprise du projet par ADA') => {
      gh.pulls.list.mockResolvedValue({ data: [{ html_url: 'https://github.com/un-po/mon-poc/pull/3' }] });
      gh.pulls.get.mockResolvedValue({ data: { number: 3, html_url: 'https://github.com/un-po/mon-poc/pull/3', merged: false, state: 'open', mergeable: true, title: titre, head: { sha: 'tete' } } });
    };

    it('analyse en cours : pas encore de PR', async () => {
      agent.verrouActif.mockResolvedValue({ pid: 1 });
      expect(await service.etat('jeton', 'un-po~mon-poc')).toMatchObject({ analyseEnCours: true, pullRequest: null, fusionnable: false, raison: 'ADA analyse le projet' });
    });

    it('PR prête : fusionnable quand le contrôle du titre est vert', async () => {
      prOuverte();
      gh.checks.listForRef.mockResolvedValue({ data: { check_runs: [{ name: 'Titre de PR (Conventional Commits, semver)', status: 'completed', conclusion: 'success' }] } });
      expect(await service.etat('jeton', 'un-po~mon-poc')).toMatchObject({ pullRequest: { numero: 3, etat: 'ouverte' }, fusionnable: true });
    });

    it('PR prête mais contrôle en cours : pas encore fusionnable', async () => {
      prOuverte();
      gh.checks.listForRef.mockResolvedValue({ data: { check_runs: [] } });
      expect(await service.etat('jeton', 'un-po~mon-poc')).toMatchObject({ fusionnable: false });
      await expect(service.fusionner('jeton', 'un-po~mon-poc')).rejects.toBeInstanceOf(ConflictException);
      expect(gh.pulls.merge).not.toHaveBeenCalled();
    });

    it('validée par le PO : fusion en squash, puis topic ada', async () => {
      prOuverte();
      gh.checks.listForRef.mockResolvedValue({ data: { check_runs: [{ name: 'Titre de PR (Conventional Commits, semver)', status: 'completed', conclusion: 'success' }] } });
      gh.repos.get.mockResolvedValue({ data: depot('mon-poc', 'un-po', ['vue', 'ada-studio-reprise']) });
      await service.fusionner('jeton', 'un-po~mon-poc');
      expect(gh.pulls.merge).toHaveBeenCalledWith(expect.objectContaining({ pull_number: 3, merge_method: 'squash', commit_title: 'chore: reprise du projet par ADA (#3)' }));
      expect(gh.repos.replaceAllTopics).toHaveBeenCalledWith({ owner: 'un-po', repo: 'mon-poc', names: ['vue', 'ada-studio-reprise', 'ada-studio'] });
    });

    it('aucune demande ne se lance tant que la reprise n’est pas fusionnée', async () => {
      gh.repos.get.mockResolvedValue({ data: depot('mon-poc', 'un-po', ['ada-studio-reprise']) });
      gh.repos.getContent.mockRejectedValue(Object.assign(new Error('absent'), { status: 404 }));
      await expect(service.verifierRepriseTerminee('jeton', 'un-po~mon-poc')).rejects.toThrow(/Validez d’abord la reprise/);
      gh.repos.get.mockResolvedValue({ data: depot('mon-poc', 'un-po', ['ada-studio']) });
      await expect(service.verifierRepriseTerminee('jeton', 'un-po~mon-poc')).resolves.toBeUndefined();
    });
  });

  describe('annuler une reprise, ou retirer un projet d’ADA (rien n’est supprimé)', () => {
    beforeEach(() => {
      gh.git.deleteRef.mockResolvedValue({});
      gh.paginate.mockResolvedValue([
        { number: 7, body: 'Analyser ce projet comme s’il avait été créé avec ADA, et proposer…' },
        { number: 8, body: 'Autre demande libre' },
      ]);
    });

    it('reprise en attente : PR fermée, branche retirée, analyse close, marquage retiré', async () => {
      gh.repos.get.mockResolvedValue({ data: depot('mon-poc', 'un-po', ['vue', 'ada-studio-reprise']) });
      gh.pulls.list.mockResolvedValue({ data: [{ html_url: 'https://github.com/un-po/mon-poc/pull/3' }] });
      expect(await service.annuler('jeton', 'un-po', 'un-po~mon-poc')).toEqual({ etat: 'annulee' });
      expect(gh.pulls.update).toHaveBeenCalledWith({ owner: 'un-po', repo: 'mon-poc', pull_number: 3, state: 'closed' });
      expect(gh.git.deleteRef).toHaveBeenCalledWith({ owner: 'un-po', repo: 'mon-poc', ref: 'heads/ada/reprise' });
      expect(gh.issues.update).toHaveBeenCalledWith({ owner: 'un-po', repo: 'mon-poc', issue_number: 7, state: 'closed', state_reason: 'not_planned' });
      expect(gh.issues.update).not.toHaveBeenCalledWith(expect.objectContaining({ issue_number: 8 }));
      expect(gh.repos.replaceAllTopics).toHaveBeenCalledWith({ owner: 'un-po', repo: 'mon-poc', names: ['vue'] });
    });

    it('reprise validée : désynchronisée, seul le marquage d’ADA est retiré', async () => {
      gh.repos.get.mockResolvedValue({ data: depot('mon-poc', 'un-po', ['vue', 'ada-studio-reprise', 'ada-studio']) });
      expect(await service.annuler('jeton', 'un-po', 'un-po~mon-poc')).toEqual({ etat: 'desynchronisee' });
      expect(gh.repos.replaceAllTopics).toHaveBeenCalledWith({ owner: 'un-po', repo: 'mon-poc', names: ['vue'] });
      expect(gh.pulls.update).not.toHaveBeenCalled();
      expect(gh.git.deleteRef).not.toHaveBeenCalled();
      expect(gh.issues.update).not.toHaveBeenCalled();
    });

    it('projet créé par ADA : retiré d’ADA de la même façon, seul son marquage est retiré', async () => {
      gh.repos.get.mockResolvedValue({ data: depot('signalements', 'proprio', ['carte', 'ada-studio']) });
      expect(await service.annuler('jeton', 'un-po', 'signalements')).toEqual({ etat: 'desynchronisee' });
      expect(gh.repos.replaceAllTopics).toHaveBeenCalledWith({ owner: 'proprio', repo: 'signalements', names: ['carte'] });
      expect(gh.pulls.update).not.toHaveBeenCalled();
      expect(gh.git.deleteRef).not.toHaveBeenCalled();
      expect(gh.issues.update).not.toHaveBeenCalled();
    });

    it('refuse pour un projet qui n’est pas dans ADA, ou pendant que ADA travaille', async () => {
      gh.repos.get.mockResolvedValue({ data: depot('autre', 'proprio', ['vue']) });
      await expect(service.annuler('jeton', 'un-po', 'autre')).rejects.toThrow(/pas dans ADA/);
      agent.verrouActif.mockResolvedValueOnce({ pid: 1 });
      await expect(service.annuler('jeton', 'un-po', 'un-po~mon-poc')).rejects.toBeInstanceOf(ConflictException);
      expect(gh.repos.replaceAllTopics).not.toHaveBeenCalled();
    });
  });

  it('demande d’analyse lisible : stack et apparence', () => {
    expect(texteDemandeAnalyse(null)).toContain('Stack : à déduire du projet');
    expect(texteDemandeAnalyse('Vue + Node')).toContain('Apparence : celle du projet');
  });
});
