import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Octokit } from '@octokit/rest';
import { ADA_PAR_DEFAUT } from '../ada/ada-config.js';
import { adaJsonReprise, APERCU_SANS_ECRAN, BRANCHE_REPRISE, corpsReprise, fichiersAApporter, FICHIERS_REPRISE, ouvrirPrReprise, TITRE_REPRISE } from './reprise.js';

const modele = mkdtempSync(join(tmpdir(), 'ada-test-reprise-'));
for (const fichier of FICHIERS_REPRISE) {
  mkdirSync(dirname(join(modele, fichier)), { recursive: true });
  writeFileSync(join(modele, fichier), `contenu de ${fichier}`);
}
afterAll(() => rmSync(modele, { recursive: true, force: true }));
const absent = () => Object.assign(new Error('absent'), { status: 404 });

describe('reprise : règles et écritures GitHub (#37)', () => {
  const gh = {
    repos: { getContent: vi.fn() },
    pulls: { list: vi.fn(), create: vi.fn() },
    git: { getRef: vi.fn(), getCommit: vi.fn(), createTree: vi.fn(), createCommit: vi.fn(), createRef: vi.fn(), updateRef: vi.fn() },
  };
  const octokit = gh as unknown as Octokit;

  beforeEach(() => {
    vi.clearAllMocks();
    gh.repos.getContent.mockRejectedValue(absent());
    gh.pulls.list.mockResolvedValue({ data: [] });
    gh.pulls.create.mockResolvedValue({ data: { html_url: 'https://github.com/un-po/mon-poc/pull/3' } });
    gh.git.getRef.mockResolvedValue({ data: { object: { sha: 'sha-main' } } });
    gh.git.getCommit.mockResolvedValue({ data: { tree: { sha: 'arbre-main' } } });
    gh.git.createTree.mockResolvedValue({ data: { sha: 'arbre' } });
    gh.git.createCommit.mockResolvedValue({ data: { sha: 'commit' } });
    gh.git.createRef.mockResolvedValue({});
  });

  it('n’apporte que les fichiers manquants, plus ada.json', async () => {
    gh.repos.getContent.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '.github/ISSUE_TEMPLATE/bug.yml') return { data: {} };
      throw absent();
    });
    const fichiers = await fichiersAApporter(octokit, 'un-po', 'mon-poc', modele, '{}');
    expect([...fichiers.keys()]).not.toContain('.github/ISSUE_TEMPLATE/bug.yml');
    expect([...fichiers.keys()]).toEqual(expect.arrayContaining(['.github/ISSUE_TEMPLATE/user-story.yml', '.github/workflows/titre-pr.yml', '.github/workflows/taille-fichiers.yml', 'ada.json']));
  });

  it('un commit au nom du PO sur ada/reprise, puis une PR vers main, sans toucher main', async () => {
    const url = await ouvrirPrReprise(octokit, { owner: 'un-po', repo: 'mon-poc', login: 'un-po' }, new Map([['ada.json', '{}']]), 'corps');
    expect(url).toBe('https://github.com/un-po/mon-poc/pull/3');
    expect(gh.git.createTree).toHaveBeenCalledWith(expect.objectContaining({ base_tree: 'arbre-main' }));
    expect(gh.git.createCommit).toHaveBeenCalledWith(expect.objectContaining({ parents: ['sha-main'], author: { name: 'un-po', email: 'un-po@users.noreply.github.com' } }));
    expect(gh.git.createRef).toHaveBeenCalledWith(expect.objectContaining({ ref: `refs/heads/${BRANCHE_REPRISE}`, sha: 'commit' }));
    expect(gh.git.updateRef).not.toHaveBeenCalled();
    expect(gh.pulls.create).toHaveBeenCalledWith(expect.objectContaining({ head: BRANCHE_REPRISE, base: 'main', title: TITRE_REPRISE }));
  });

  it('remplace la branche d’une reprise interrompue ; une PR déjà ouverte est renvoyée telle quelle', async () => {
    gh.git.createRef.mockRejectedValue(Object.assign(new Error('existe'), { status: 422 }));
    await ouvrirPrReprise(octokit, { owner: 'un-po', repo: 'mon-poc', login: 'un-po' }, new Map(), 'corps');
    expect(gh.git.updateRef).toHaveBeenCalledWith(expect.objectContaining({ ref: `heads/${BRANCHE_REPRISE}`, force: true }));

    vi.clearAllMocks();
    gh.pulls.list.mockResolvedValue({ data: [{ html_url: 'https://github.com/un-po/mon-poc/pull/1' }] });
    expect(await ouvrirPrReprise(octokit, { owner: 'un-po', repo: 'mon-poc', login: 'un-po' }, new Map(), 'corps')).toBe('https://github.com/un-po/mon-poc/pull/1');
    expect(gh.git.createCommit).not.toHaveBeenCalled();
  });

  it('ada.json repris : aperçu proposé, aucun fichier à personnaliser, seul le titre de PR exigé, pas de chart, édition studio, apparence du projet', () => {
    const ada = JSON.parse(adaJsonReprise(JSON.stringify({ ...ADA_PAR_DEFAUT, personnaliser: ['README.md'], deploiement: { chart: 'charts/app' } }))) as Record<string, unknown>;
    expect(ada).toMatchObject({ personnaliser: [], controlesRequis: ['Titre de PR (Conventional Commits, semver)', 'Taille des fichiers (une responsabilité par fichier)'], deploiement: null, edition: 'studio', style: null, composants: null, apercu: ADA_PAR_DEFAUT.apercu });
  });

  it('projet sans écran (script) : l’aperçu sert les fichiers du projet, la reprise n’est plus bloquée', () => {
    // Cas réel : l'analyse d'un script Python a rendu une commande et un port vides.
    const analyse = { type: 'traitement', controles: ['cd /app && python3 -m compileall -q .'], apercu: { image: 'python:3.13-slim', principal: null, port: null } };
    const ada = JSON.parse(adaJsonReprise(analyse)) as { apercu: { principal: string; port: number; image: string } };
    expect(ada.apercu).toMatchObject({ image: 'python:3.13-slim', principal: APERCU_SANS_ECRAN.principal, port: 8000 });
    expect(JSON.parse(adaJsonReprise({ ...analyse, apercu: undefined })).apercu).toMatchObject({ principal: APERCU_SANS_ECRAN.principal, port: 8000 });
  });

  it('une commande sans port reste refusée : le port ne se devine pas', () => {
    expect(() => adaJsonReprise({ type: 'service', controles: ['npm test'], apercu: { principal: 'npm run dev', port: null } })).toThrow();
  });

  it('refuse un aperçu invalide (l’analyse n’a pas su le décrire)', () => {
    expect(() => adaJsonReprise({ apercu: {} })).toThrow();
    expect(() => adaJsonReprise(null)).toThrow();
  });

  it('corps de la PR : stack ou analyse, apparence, lien vers l’analyse', () => {
    const corps = corpsReprise({ stack: null, fichiers: ['ada.json'], login: 'un-po', analyse: 'https://github.com/un-po/mon-poc/issues/7' });
    expect(corps).toContain('Aperçu décrit par l’analyse du projet');
    expect(corps).toContain('celle du projet');
    expect(corps).toContain('/issues/7');
  });
});
