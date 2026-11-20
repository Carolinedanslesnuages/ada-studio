import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { lireConfig } from '../config.js';
import type { AgentService } from '../agent/agent.service.js';
import type { ApercuService } from '../apercu/apercu.service.js';
import type { GithubService } from '../github/github.service.js';
import type { StoriesService } from '../stories/stories.service.js';
import type { DemoService } from '../demo/demo.service.js';
import { VerificationService } from './verification.service.js';
import { ADA_PAR_DEFAUT } from '../ada/ada-config.js';
import type { ProjetsService } from '../projets/projets.service.js';

const config = lireConfig({ GITHUB_PROPRIETAIRE: 'proprio', GITHUB_CLIENT_ID: 'Iv', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: 'x'.repeat(32) });
const NOMS = ['Anti-fuite (gitleaks)', 'API (lint, tests, compilation)', 'Front (lint, types, tests dont accessibilité, compilation)'];
const runs = (conclusion: string | null, status = 'completed') => ({
  data: { check_runs: NOMS.map((name) => ({ name, status, conclusion, html_url: null })) },
});

describe('VerificationService', () => {
  const gh = {
    pulls: { get: vi.fn(), list: vi.fn(), merge: vi.fn(), updateBranch: vi.fn() },
    repos: { compareCommits: vi.fn(), getBranch: vi.fn() },
    checks: { listForRef: vi.fn() },
    issues: { update: vi.fn(), get: vi.fn() },
  };
  const agent = {
  activite: vi.fn(async (): Promise<{ pullRequest: string | null; tete?: string | null }> => ({ pullRequest: 'https://github.com/proprio/poc/pull/3' })),
  noterTete: vi.fn(async () => undefined),
};
  const stories = { retirerStatut: vi.fn(), signalerLivraisonAuParent: vi.fn(), detail: vi.fn(async () => ({ titre: 'Page d’accueil', type: 'story' })) };
  const apercu = { revenirSurMain: vi.fn(), relancerApplication: vi.fn() };
  const demo = { mettreAJour: vi.fn() };
  const projets = { lireConfigDepot: vi.fn(async () => ADA_PAR_DEFAUT), controlesExiges: vi.fn(async (): Promise<string[] | null> => null) };
  let service: VerificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    projets.controlesExiges.mockResolvedValue(null);
    projets.lireConfigDepot.mockResolvedValue(ADA_PAR_DEFAUT);
    agent.activite.mockResolvedValue({ pullRequest: 'https://github.com/proprio/poc/pull/3' });
    gh.issues.get.mockResolvedValue({ data: { state: 'open' } });
    gh.repos.compareCommits.mockResolvedValue({ data: { ahead_by: 0 } });
    gh.repos.getBranch.mockResolvedValue({ data: { commit: { sha: 'nouveau' } } });
    gh.pulls.get.mockResolvedValue({
      data: { number: 3, html_url: 'https://github.com/proprio/poc/pull/3', merged: false, state: 'open', mergeable: true, title: 'feat: Page d’accueil', head: { sha: 'abc', ref: 'story/1-page-d-accueil' }, base: { ref: 'main' } },
    });
    service = new VerificationService(
      config,
      { client: () => gh } as unknown as GithubService,
      agent as unknown as AgentService,
      stories as unknown as StoriesService,
      apercu as unknown as ApercuService,
      projets as unknown as ProjetsService,
      demo as unknown as DemoService,
    );
  });

  it('montre les contrôles et autorise la fusion quand tout est vert', async () => {
    gh.checks.listForRef.mockResolvedValue(runs('success'));
    const v = await service.verifier('jeton', 'poc', 1);
    expect(gh.checks.listForRef).toHaveBeenCalledWith(expect.objectContaining({ ref: 'abc' }));
    expect(v.pullRequest).toEqual({ numero: 3, url: 'https://github.com/proprio/poc/pull/3', etat: 'ouverte' });
    expect(v.controles.map((c) => c.etat)).toEqual(['reussi', 'reussi', 'reussi']);
    expect(v.fusionnable).toBe(true);
  });

  it('retrouve la pull request sur GitHub par sa branche quand l’activité locale a disparu', async () => {
    agent.activite.mockResolvedValueOnce({ pullRequest: null });
    gh.pulls.list.mockResolvedValue({ data: [{ number: 3 }] });
    gh.checks.listForRef.mockResolvedValue(runs('success'));
    const v = await service.verifier('jeton', 'poc', 1);
    expect(gh.pulls.list).toHaveBeenCalledWith(expect.objectContaining({ owner: 'proprio', repo: 'poc', head: 'proprio:story/1-page-d-accueil', state: 'all' }));
    expect(v.pullRequest?.numero).toBe(3);
    expect(v.fusionnable).toBe(true);
  });

  it('sans pull request ni localement ni sur GitHub : le dit', async () => {
    agent.activite.mockResolvedValueOnce({ pullRequest: null });
    gh.pulls.list.mockResolvedValue({ data: [] });
    expect(await service.verifier('jeton', 'poc', 1)).toMatchObject({ pullRequest: null, fusionnable: false, raison: 'Aucune pull request pour cette demande' });
  });

  it('refuse de fusionner tant que des contrôles tournent', async () => {
    gh.checks.listForRef.mockResolvedValue(runs(null, 'in_progress'));
    await expect(service.fusionner('jeton', 'poc', 1)).rejects.toThrow(ConflictException);
    expect(gh.pulls.merge).not.toHaveBeenCalled();
  });

  it('refuse de fusionner si un contrôle a échoué', async () => {
    gh.checks.listForRef.mockResolvedValue(runs('failure'));
    await expect(service.fusionner('jeton', 'poc', 1)).rejects.toThrow(/a échoué/);
    expect(gh.pulls.merge).not.toHaveBeenCalled();
  });

  it('fusionne en un commit Conventional Commits, ferme l’issue et remet l’aperçu sur main', async () => {
    gh.checks.listForRef.mockResolvedValue(runs('success'));
    await service.fusionner('jeton', 'poc', 1);
    expect(gh.pulls.merge).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 3, sha: 'abc', merge_method: 'squash', commit_title: 'feat: Page d’accueil (#3)', commit_message: 'Closes #1' }),
    );
    expect(gh.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 1, state: 'closed' }));
    expect(stories.retirerStatut).toHaveBeenCalledWith('jeton', 'poc', 1);
    // Story issue d'un découpage : cochée dans sa demande parent (#36).
    expect(stories.signalerLivraisonAuParent).toHaveBeenCalledWith('jeton', 'poc', 1);
    expect(apercu.revenirSurMain).toHaveBeenCalledWith('jeton', 'poc');
    // L'API de l'aperçu est relancée : elle sert le code fusionné, pas une ancienne version.
    expect(apercu.relancerApplication).toHaveBeenCalledWith('poc');
    // Le lien de démonstration passe à la version qui vient d'être validée.
    expect(demo.mettreAJour).toHaveBeenCalledWith('jeton', 'poc');
    expect(apercu.revenirSurMain.mock.invocationCallOrder[0]).toBeLessThan(apercu.relancerApplication.mock.invocationCallOrder[0]!);
  });

  it('ne refait pas la fermeture si « Closes #n » a déjà fermé l’issue (pas d’erreur 500)', async () => {
    gh.checks.listForRef.mockResolvedValue(runs('success'));
    gh.issues.get.mockResolvedValue({ data: { state: 'closed' } });
    await expect(service.fusionner('jeton', 'poc', 1)).resolves.toBeDefined();
    expect(gh.issues.update).not.toHaveBeenCalled();
    expect(stories.retirerStatut).toHaveBeenCalled();
    expect(apercu.revenirSurMain).toHaveBeenCalled();
  });

  it('continue le ménage même si GitHub refuse la fermeture (fermée entre-temps)', async () => {
    gh.checks.listForRef.mockResolvedValue(runs('success'));
    gh.issues.update.mockRejectedValueOnce({ status: 422, message: 'This issue was closed by another request' });
    await expect(service.fusionner('jeton', 'poc', 1)).resolves.toBeDefined();
    expect(stories.retirerStatut).toHaveBeenCalled();
    expect(apercu.revenirSurMain).toHaveBeenCalled();
  });

  it('met d’abord à jour une branche en retard sur main, sans fusionner', async () => {
    gh.checks.listForRef.mockResolvedValue(runs('success'));
    gh.repos.compareCommits.mockResolvedValue({ data: { ahead_by: 2 } });
    const resultat = await service.fusionner('jeton', 'poc', 1);
    expect(gh.repos.compareCommits).toHaveBeenCalledWith(expect.objectContaining({ base: 'abc', head: 'main' }));
    expect(gh.pulls.updateBranch).toHaveBeenCalledWith(expect.objectContaining({ pull_number: 3, expected_head_sha: 'abc' }));
    expect(gh.pulls.merge).not.toHaveBeenCalled();
    expect(resultat.fusionnable).toBe(false);
    expect(resultat.raison).toMatch(/mise à jour et les contrôles sont relancés/);
    expect(agent.noterTete).toHaveBeenCalledWith('poc', 1, 'nouveau'); // la mise à jour vient d'ADA : le nouveau bout est le sien
  });

  it('exige les contrôles de la règle de protection de GitHub, même si ada.json en annonce moins', async () => {
    // ada.json (modifiable par d'autres) ne demanderait plus que l'anti-fuite ; la règle de GitHub exige les trois.
    projets.lireConfigDepot.mockResolvedValue({ ...ADA_PAR_DEFAUT, controlesRequis: ['Anti-fuite (gitleaks)'] });
    projets.controlesExiges.mockResolvedValue(NOMS);
    gh.checks.listForRef.mockResolvedValue({ data: { check_runs: [{ name: 'Anti-fuite (gitleaks)', status: 'completed', conclusion: 'success', html_url: null }] } });
    const verification = await service.verifier('jeton', 'poc', 1);
    expect(verification.controles.map((controle) => controle.nom)).toEqual(NOMS);
    expect(verification.fusionnable).toBe(false);
  });

  it('sans règle de protection, revient aux contrôles d’ada.json', async () => {
    projets.controlesExiges.mockResolvedValue(null);
    gh.checks.listForRef.mockResolvedValue(runs('success'));
    expect((await service.verifier('jeton', 'poc', 1)).controles.map((controle) => controle.nom)).toEqual(ADA_PAR_DEFAUT.controlesRequis);
  });

  describe('la branche est exactement ce qu’ADA a poussé', () => {
    const pullRequest = 'https://github.com/proprio/poc/pull/3';

    it('refuse de fusionner si un commit a été ajouté à la branche en dehors d’ADA, même avec des contrôles verts', async () => {
      agent.activite.mockResolvedValue({ pullRequest, tete: 'sha-poussé-par-ada' });
      gh.checks.listForRef.mockResolvedValue(runs('success'));
      const verification = await service.verifier('jeton', 'poc', 1);
      expect(verification.fusionnable).toBe(false);
      expect(verification.raison).toMatch(/en dehors d’ADA/);
      await expect(service.fusionner('jeton', 'poc', 1)).rejects.toThrow(/en dehors d’ADA/);
      expect(gh.pulls.merge).not.toHaveBeenCalled();
    });

    it('autorise la fusion quand la branche est au commit poussé par ADA', async () => {
      agent.activite.mockResolvedValue({ pullRequest, tete: 'abc' });
      gh.checks.listForRef.mockResolvedValue(runs('success'));
      expect((await service.verifier('jeton', 'poc', 1)).fusionnable).toBe(true);
    });

    it('ne compare rien quand ADA n’a pas noté de commit (demande d’avant ce changement)', async () => {
      agent.activite.mockResolvedValue({ pullRequest, tete: null });
      gh.checks.listForRef.mockResolvedValue(runs('success'));
      expect((await service.verifier('jeton', 'poc', 1)).fusionnable).toBe(true);
    });
  });

  it('considère la fusion faite même si l’aperçu ne peut pas être remis à jour', async () => {
    gh.checks.listForRef.mockResolvedValue(runs('success'));
    apercu.revenirSurMain.mockRejectedValueOnce(new Error('git occupé'));
    await expect(service.fusionner('jeton', 'poc', 1)).resolves.toBeDefined();
    expect(gh.pulls.merge).toHaveBeenCalled();
  });

  it('sans pull request : rien à fusionner', async () => {
    agent.activite.mockResolvedValueOnce({ pullRequest: null });
    expect(await service.verifier('jeton', 'poc', 1)).toEqual({
      pullRequest: null,
      controles: [],
      fusionnable: false,
      raison: 'Aucune pull request pour cette demande',
    });
  });
});
