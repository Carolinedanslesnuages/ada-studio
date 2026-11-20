import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ADA_PAR_DEFAUT } from '../ada/ada-config.js';
import { lireConfig } from '../config.js';
import type { ApercuService } from '../apercu/apercu.service.js';
import type { GithubService } from '../github/github.service.js';
import { ProjetsService } from './projets.service.js';

const racine = mkdtempSync(join(tmpdir(), 'ada-test-projets-'));
const dossierCatalogue = join(racine, 'catalogue');
const dossierSkills = join(racine, 'skills-po');
/** Ce que la skill du test ajoute à chaque projet créé : le dossier commun et le lien de Claude Code. */
const SKILLS_LIVREES = ['.agents/skills/po-bug/SKILL.md', '.agents/skills/po-bug/references/methode.md', '.claude/skills/po-bug'];

const variables = {
  GITHUB_PROPRIETAIRE: 'proprio',
  GITHUB_CLIENT_ID: 'Iv',
  GITHUB_CLIENT_SECRET: 's',
  SESSION_SECRET: 'x'.repeat(32),
};
/** Dossier des aperçus des tests : jamais celui d'ADA (le choix de protection d'un PO y est écrit). */
const dossierApercus = mkdtempSync(join(tmpdir(), 'apercus-projets-'));
const config = lireConfig({ ...variables, CATALOGUE: dossierCatalogue, SKILLS_PO: dossierSkills, DOSSIER_APERCUS: dossierApercus });

const depot = (name: string, topics: string[], updated_at = '2026-11-16T10:00:00Z', owner = 'proprio') => ({
  name,
  owner: { login: owner },
  default_branch: 'main',
  topics,
  updated_at,
  description: null,
  private: true,
  html_url: `https://github.com/${owner}/${name}`,
});

const git = (dossier: string, ...args: string[]) =>
  execFileSync('git', [...(dossier.endsWith('.git') ? ['--git-dir', dossier] : ['-C', dossier]), ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

const ecrire = (fichier: string, contenu: string) => {
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, contenu);
};

/** Catalogue de test : deux modèles livrés, dans un dépôt git (comme celui d'ADA). */
const preparerCatalogue = () => {
  rmSync(racine, { recursive: true, force: true });
  ecrire(join(dossierCatalogue, '.gitignore'), 'node_modules/\n');
  ecrire(join(dossierCatalogue, 'vue-nest', 'ada.json'), JSON.stringify({ ...ADA_PAR_DEFAUT, personnaliser: ['PROJET.md'] }));
  ecrire(join(dossierCatalogue, 'vue-nest', 'PROJET.md'), '# __NOM_PROJET__\n__OBJECTIF__');
  ecrire(join(dossierCatalogue, 'vue-nest', 'front', 'src', 'App.vue'), 'sans marqueur __NOM_PROJET__');
  ecrire(join(dossierCatalogue, 'vue-nest', 'node_modules', 'lourd.js'), 'à ne pas copier');
  ecrire(
    join(dossierCatalogue, 'maquette', 'ada.json'),
    JSON.stringify({ type: 'maquette', edition: 'studio', personnaliser: ['index.html'], controlesRequis: ['Maquette (tests)'], controles: ['npm test'], apercu: { npm: ['.'], principal: 'npx vite' } }),
  );
  ecrire(join(dossierCatalogue, 'maquette', 'index.html'), '<title>__NOM_PROJET__</title>');
  ecrire(
    join(dossierCatalogue, 'vue-node', 'ada.json'),
    JSON.stringify({ ...ADA_PAR_DEFAUT, personnaliser: ['charts/app/Chart.yaml'], deploiement: { chart: 'charts/app' } }),
  );
  ecrire(join(dossierCatalogue, 'vue-node', 'Dockerfile'), 'FROM node:24');
  // Modèles avec front : le quiz accepte les variantes de style et de composants, l'extension non.
  const avecFront = (variantes: boolean) =>
    JSON.stringify({ type: variantes ? 'formation' : 'extension', edition: 'studio', style: 'css-maison', composants: 'aucune', interface: { dossier: '.', variantes }, controlesRequis: ['Front'], controles: ['npm test'], apercu: { npm: ['.'], principal: 'npx vite' } });
  ecrire(join(dossierCatalogue, 'quiz', 'ada.json'), avecFront(true));
  ecrire(join(dossierCatalogue, 'quiz', 'package.json'), JSON.stringify({ name: 'quiz', dependencies: { vue: '3.5.42' }, devDependencies: {} }));
  ecrire(join(dossierCatalogue, 'quiz', 'AGENTS.md'), '# Quiz\n\n<!-- ada:interface:debut -->\nbase\n<!-- ada:interface:fin -->\n\n## Accessibilité\n');
  ecrire(join(dossierCatalogue, 'extension', 'ada.json'), avecFront(false));
  ecrire(join(dossierCatalogue, 'vue-node', 'charts', 'app', 'Chart.yaml'), 'name: __SLUG__');
  ecrire(join(dossierCatalogue, 'vue-node', 'charts', 'app', 'templates', 'deployment.yaml'), 'kind: Deployment');
  git(dossierCatalogue, 'init', '--quiet');
  ecrire(join(dossierSkills, 'po-bug', 'SKILL.md'), '---\nname: po-bug\n---\n');
  ecrire(join(dossierSkills, 'po-bug', 'references', 'methode.md'), 'méthode');
};

/** Dépôt « GitHub » du projet : un dépôt nu local, vide comme après la création. */
const depotDistant = () => {
  const nu = join(racine, 'distant.git');
  execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', nu]);
  return nu;
};

const fichiersPousses = (nu: string) => git(nu, 'ls-tree', '-r', '--name-only', 'main').trim().split('\n');
const lirePousse = (nu: string, fichier: string) => git(nu, 'show', `main:${fichier}`);

describe('ProjetsService', () => {
  const gh = {
    paginate: vi.fn(),
    request: vi.fn(),
    repos: {
      listForAuthenticatedUser: vi.fn(),
      listForOrg: vi.fn(),
      get: vi.fn(),
      createForAuthenticatedUser: vi.fn(),
      createInOrg: vi.fn(),
      getContent: vi.fn(),
      replaceAllTopics: vi.fn(),
      update: vi.fn(),
    },
    issues: { createLabel: vi.fn(), create: vi.fn(), createComment: vi.fn() },
    pulls: { list: vi.fn() },
  };
  const github = { client: vi.fn(() => gh) } as unknown as GithubService;
  const apercu = { environnementGit: () => ({ ...process.env }) } as unknown as ApercuService;
  let service: ProjetsService;
  let distant: string;

  const projetValide = { nom: "L'annuaire", objectif: 'Trouver un collègue et son bureau', modele: 'vue-nest' };

  const preparerCreation = () => {
    gh.repos.get.mockRejectedValue({ status: 404 });
    gh.repos.createForAuthenticatedUser.mockResolvedValue({ data: depot('l-annuaire', []) });
    gh.repos.createInOrg.mockResolvedValue({ data: depot('l-annuaire', []) });
    gh.request.mockResolvedValue({ data: [] });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    preparerCatalogue();
    distant = depotDistant();
    service = new ProjetsService(config, github, apercu);
    service.urlDepot = () => distant;
  });

  afterEach(() => rmSync(racine, { recursive: true, force: true }));

  it('liste les projets d’ADA studio, jamais ceux de l’ADA du travail, sans passer par la recherche', async () => {
    gh.paginate.mockResolvedValue([
      depot('ancien', ['ada-studio'], '2026-01-01T00:00:00Z'),
      depot('du-travail', ['ada']),
      depot('du-travail-avant', ['atelier-po']),
      depot('autre', ['perso']),
      depot('en-creation', ['ada-studio-creation']),
      depot('recent', ['ada-studio'], '2026-11-16T00:00:00Z'),
    ]);
    const projets = await service.lister('jeton', 'Proprio');
    expect(gh.paginate).toHaveBeenCalledWith(gh.repos.listForAuthenticatedUser, expect.objectContaining({ affiliation: 'owner' }));
    expect(projets.map((p) => p.nom)).toEqual(['recent', 'ancien']);
  });

  it('liste les dépôts de l’organisation quand le propriétaire n’est pas le PO', async () => {
    gh.paginate.mockResolvedValue([]);
    await service.lister('jeton', 'un-po');
    expect(gh.paginate).toHaveBeenCalledWith(gh.repos.listForOrg, expect.objectContaining({ org: 'proprio' }));
  });

  it('liste aussi les projets du compte personnel du PO, avec un identifiant « compte~nom » (#37)', async () => {
    gh.paginate.mockImplementation(async (methode: unknown) =>
      methode === gh.repos.listForOrg ? [depot('commun', ['ada-studio'])] : [depot('Perso', ['ada-studio'], '2026-11-17T00:00:00Z', 'Un-PO')],
    );
    const projets = await service.lister('jeton', 'un-po');
    expect(projets).toEqual([
      expect.objectContaining({ id: 'un-po~perso', nom: 'Perso', proprietaire: 'Un-PO', compte: 'personnel' }),
      expect.objectContaining({ id: 'commun', nom: 'commun', proprietaire: 'proprio', compte: 'organisation' }),
    ]);
  });

  it('une reprise est visible dès son lancement (PR à valider), puis devient un projet ADA une fois fusionnée', async () => {
    gh.paginate.mockResolvedValue([depot('repris', ['vue', 'ada-studio-reprise']), depot('en-attente', ['ada-studio-reprise'])]);
    gh.repos.getContent.mockImplementation(async ({ repo }: { repo: string }) => {
      if (repo === 'repris') return { data: { content: '' } };
      throw Object.assign(new Error('absent'), { status: 404 });
    });
    gh.repos.replaceAllTopics.mockResolvedValue({});
    gh.pulls.list.mockResolvedValue({ data: [{ html_url: 'https://github.com/proprio/en-attente/pull/2' }] });
    const projets = await service.lister('jeton', 'proprio');
    expect(projets).toEqual([
      expect.objectContaining({ id: 'repris', reprise: null, repris: true }),
      expect.objectContaining({ id: 'en-attente', reprise: { pullRequest: 'https://github.com/proprio/en-attente/pull/2' } }),
    ]);
    expect(gh.repos.replaceAllTopics).toHaveBeenCalledWith({ owner: 'proprio', repo: 'repris', names: ['vue', 'ada-studio-reprise', 'ada-studio'] });
  });

  it('refuse un projet invalide sans rien créer', async () => {
    await expect(service.creer('jeton', 'po', { nom: 'x', objectif: '', modele: '' })).rejects.toBeInstanceOf(BadRequestException);
    expect(gh.repos.createForAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('ne propose que les modèles livrés dans le catalogue d’ADA, sans dépôt modèle GitHub', () => {
    const { familles, types, modeles } = service.modeles();
    expect(types.map((t) => t.id)).toEqual(expect.arrayContaining(['service', 'formulaire', 'extension', 'api', 'maquette']));
    for (const type of types) expect(familles.map((f) => f.id)).toContain(type.famille);
    for (const modele of modeles) expect(types.map((t) => t.id)).toContain(modele.type);
    for (const type of types) expect(modeles.some((m) => m.type === type.id)).toBe(true);
    expect(modeles.filter((m) => m.disponible).map((m) => m.id)).toEqual(['vue-nest', 'vue-node', 'quiz', 'extension', 'maquette']);
    expect(modeles.filter((m) => m.deployable).map((m) => m.id)).toEqual(['vue-node']);
    expect(modeles.find((m) => m.id === 'formulaire')).toMatchObject({ type: 'formulaire', disponible: false });
    expect(gh.repos.get).not.toHaveBeenCalled();
  });

  it('trouve par défaut le catalogue à la racine du dépôt d’ADA', () => {
    const parDefaut = new ProjetsService(lireConfig(variables), github, apercu);
    expect(parDefaut.dossierCatalogue).toMatch(/[/\\]catalogue$/);
    expect(parDefaut.modeles().modeles.find((m) => m.id === 'vue-nest')!.disponible).toBe(true);
  });

  it('refuse un type de projet dont le modèle n’est pas encore livré', async () => {
    preparerCreation();
    await expect(service.creer('jeton', 'po', { ...projetValide, modele: 'django' })).rejects.toBeInstanceOf(BadRequestException);
    expect(gh.repos.createForAuthenticatedUser).not.toHaveBeenCalled();
  });

  describe('style et bibliothèque de composants choisis à la création', () => {
    it('les enregistre dans ada.json, les applique (dépendances, fichiers, consignes) et les écrit dans AGENTS.md', async () => {
      preparerCreation();
      await service.creer('jeton', 'proprio', { ...projetValide, modele: 'quiz', style: 'tailwind', composants: 'reka-ui' });
      expect(JSON.parse(lirePousse(distant, 'ada.json'))).toMatchObject({ edition: 'studio', style: 'tailwind', composants: 'reka-ui' });
      const paquet = JSON.parse(lirePousse(distant, 'package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
      expect(paquet.dependencies['reka-ui']).toMatch(/^\d+\.\d+\.\d+$/);
      expect(paquet.devDependencies.tailwindcss).toMatch(/^\d+\.\d+\.\d+$/);
      expect(lirePousse(distant, 'vite.style.ts')).toContain('tailwindcss()');
      expect(lirePousse(distant, 'src/components/ui/FenetreDialogue.vue')).toContain("from 'reka-ui'");
      const consignes = lirePousse(distant, 'AGENTS.md');
      expect(consignes).toContain('Style : **Tailwind CSS**');
      expect(consignes).toContain('Bibliothèque de composants : **Reka UI**');
      expect(consignes).not.toContain('\nbase\n');
      expect(gh.repos.replaceAllTopics).toHaveBeenLastCalledWith(expect.objectContaining({ names: ['ada-studio'] }));
    });

    it('refuse une combinaison interdite, avec sa raison, avant de créer quoi que ce soit', async () => {
      preparerCreation();
      await expect(service.creer('jeton', 'proprio', { ...projetValide, modele: 'quiz', style: 'css-maison', composants: 'shadcn-vue' })).rejects.toMatchObject({
        response: { erreurs: { composants: expect.stringContaining('choisissez le style Tailwind') } },
      });
      expect(gh.repos.createForAuthenticatedUser).not.toHaveBeenCalled();
    });

    it('un modèle sans variantes reste en CSS maison, sans bibliothèque', async () => {
      preparerCreation();
      await expect(service.creer('jeton', 'proprio', { ...projetValide, modele: 'extension', composants: 'primevue' })).rejects.toBeInstanceOf(BadRequestException);
      expect(gh.repos.createForAuthenticatedUser).not.toHaveBeenCalled();
    });

    it('le catalogue dit quels modèles ont une interface et lesquels acceptent les variantes', () => {
      const { modeles, combinaisons } = service.modeles();
      expect(modeles.find((modele) => modele.id === 'quiz')?.interface).toEqual({ variantes: true });
      expect(modeles.find((modele) => modele.id === 'extension')?.interface).toEqual({ variantes: false });
      expect(modeles.find((modele) => modele.id === 'vue-nest')?.interface).toBeNull();
      expect(combinaisons.parDefaut).toEqual({ style: 'css-maison', composants: 'aucune' });
      expect(combinaisons.interdites).toHaveLength(5);
    });
  });

  it('refuse un nom déjà pris', async () => {
    gh.repos.get.mockResolvedValue({ data: depot('l-annuaire', []) });
    await expect(service.creer('jeton', 'po', projetValide)).rejects.toBeInstanceOf(ConflictException);
    expect(gh.repos.createForAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('crée un dépôt privé vide, le règle, puis pousse le modèle personnalisé en un seul commit', async () => {
    preparerCreation();
    const resultat = await service.creer('jeton', 'proprio', projetValide);

    expect(gh.repos.createForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'l-annuaire', private: true, auto_init: false }),
    );
    expect(fichiersPousses(distant)).toEqual([...SKILLS_LIVREES, 'PROJET.md', 'ada.json', 'front/src/App.vue']);
    expect(lirePousse(distant, 'PROJET.md')).toBe('# L’annuaire\nTrouver un collègue et son bureau.');
    // Les skills po- d'ADA sont livrées avec le projet : dossier commun, et lien relatif pour Claude Code.
    expect(lirePousse(distant, '.agents/skills/po-bug/references/methode.md')).toBe('méthode');
    expect(git(distant, 'ls-tree', 'main', '.claude/skills/po-bug')).toMatch(/^120000 blob /);
    expect(lirePousse(distant, '.claude/skills/po-bug')).toBe('../../.agents/skills/po-bug');
    expect(lirePousse(distant, 'front/src/App.vue')).toBe('sans marqueur __NOM_PROJET__');
    expect(git(distant, 'log', '--format=%an|%s', 'main').trim()).toBe('proprio|chore: création du projet L’annuaire');

    expect(gh.repos.update).toHaveBeenCalledWith(
      expect.objectContaining({ repo: 'l-annuaire', allow_squash_merge: true, allow_merge_commit: false, allow_rebase_merge: false, delete_branch_on_merge: true }),
    );
    const topics = gh.repos.replaceAllTopics.mock.calls.map((appel) => (appel[0] as { names: string[] }).names);
    expect(topics).toEqual([['ada-studio-creation'], ['ada-studio']]);
    const labels = gh.issues.createLabel.mock.calls.map((appel) => (appel[0] as { name: string }).name);
    expect(labels).toEqual(expect.arrayContaining(['user-story', 'bug', 'story:en-cours', 'story:besoin-dev']));
    const routes = gh.request.mock.calls.map(([route]) => String(route));
    expect(routes.indexOf('PUT /repos/{owner}/{repo}/actions/permissions/workflow')).toBeLessThan(routes.indexOf('POST /repos/{owner}/{repo}/rulesets'));
    expect(resultat.reglages.versionsAutomatiques.etat).toBe('fait');
    expect(resultat.reglages.protectionMain.etat).toBe('fait');
  });

  it('l’idée racontée à la création devient la première demande libre, lancée pour ADA (#68)', async () => {
    preparerCreation();
    gh.issues.create.mockResolvedValue({ data: { number: 1 } });
    const idee = 'partager les trajets entre agents, le matin surtout';
    const resultat = await service.creer('jeton', 'proprio', { nom: "L'annuaire", modele: 'vue-nest', idee });
    expect(resultat.idee).toBe(1);
    expect(gh.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'proprio', repo: 'l-annuaire', title: `Demande libre : ${idee}`, labels: ['mode-libre', 'story:en-cours'] }),
    );
    expect(gh.issues.create.mock.calls[0]![0].body).toContain(idee);
    expect(gh.issues.createComment).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 1, body: expect.stringContaining('Lancée depuis ADA') }));
    // L'objectif (description du dépôt, PROJET.md) vient de l'idée.
    expect(lirePousse(distant, 'PROJET.md')).toContain('partager les trajets entre agents, le matin surtout.');
  });

  it('sans idée, aucune demande n’est créée ; un échec de l’idée ne défait pas la création', async () => {
    preparerCreation();
    expect((await service.creer('jeton', 'proprio', projetValide)).idee).toBeNull();
    expect(gh.issues.create).not.toHaveBeenCalled();
    rmSync(distant, { recursive: true, force: true });
    distant = depotDistant();
    gh.issues.create.mockRejectedValue({ status: 500 });
    await expect(service.creer('jeton', 'proprio', { ...projetValide, nom: 'Autre projet', idee: 'une idée assez longue' })).resolves.toMatchObject({ idee: null });
  });

  it('crée un dépôt privé par défaut, public si le PO le choisit', async () => {
    preparerCreation();
    await service.creer('jeton', 'proprio', projetValide);
    expect(gh.repos.createForAuthenticatedUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'l-annuaire', private: true }));
    vi.clearAllMocks();
    preparerCreation();
    rmSync(distant, { recursive: true, force: true });
    distant = depotDistant();
    await service.creer('jeton', 'proprio', { ...projetValide, visibilite: 'public' });
    expect(gh.repos.createForAuthenticatedUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'l-annuaire', private: false }));
  });

  it('refuse une visibilité inconnue', async () => {
    preparerCreation();
    await expect(service.creer('jeton', 'proprio', { ...projetValide, visibilite: 'interne' })).rejects.toThrow(BadRequestException);
  });

  it('crée le dépôt sur le compte de la personne connectée, jamais sur celui qui a configuré ADA', async () => {
    preparerCreation();
    gh.repos.createForAuthenticatedUser.mockResolvedValue({ data: depot('l-annuaire', [], undefined, 'un-po') });
    const { projet } = await service.creer('jeton', 'un-po', projetValide);
    expect(gh.repos.get).toHaveBeenCalledWith({ owner: 'un-po', repo: 'l-annuaire' });
    expect(gh.repos.createForAuthenticatedUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'l-annuaire' }));
    expect(gh.repos.createInOrg).not.toHaveBeenCalled();
    expect(gh.repos.replaceAllTopics).toHaveBeenCalledWith(expect.objectContaining({ owner: 'un-po', repo: 'l-annuaire' }));
    // Identifiant « compte~nom » : le projet est sur le compte personnel du PO.
    expect(projet.id).toBe('un-po~l-annuaire');
  });

  it('explique au PO que l’App ne peut pas créer de dépôt (403 de GitHub)', async () => {
    preparerCreation();
    gh.repos.createForAuthenticatedUser.mockRejectedValue({ status: 403, request: { method: 'POST', url: 'x' } });
    await expect(service.creer('jeton', 'proprio', projetValide)).rejects.toThrow(/Installez-la sur votre compte GitHub/);
  });

  it('tolère un label déjà présent dans le dépôt (« bug » existe par défaut)', async () => {
    preparerCreation();
    gh.issues.createLabel.mockImplementation(async ({ name }: { name: string }) => {
      if (name === 'bug') throw { status: 422 };
    });
    await expect(service.creer('jeton', 'proprio', projetValide)).resolves.toBeDefined();
  });

  it('reprend une création interrompue après le push sans rien repousser ni doubler la protection', async () => {
    preparerCreation();
    await service.creer('jeton', 'proprio', projetValide);
    vi.clearAllMocks();
    gh.repos.get.mockResolvedValue({ data: depot('l-annuaire', ['ada-studio-creation']) });
    gh.request.mockImplementation(async (route: string) => (route.startsWith('GET') ? { data: [{ name: 'main protégée' }] } : {}));

    const resultat = await service.creer('jeton', 'proprio', projetValide);
    expect(gh.repos.createForAuthenticatedUser).not.toHaveBeenCalled();
    expect(git(distant, 'rev-list', '--count', 'main').trim()).toBe('1');
    expect(gh.request.mock.calls.some(([route]) => route === 'POST /repos/{owner}/{repo}/rulesets')).toBe(false);
    expect(gh.repos.replaceAllTopics).toHaveBeenCalledWith(expect.objectContaining({ names: ['ada-studio'] }));
    expect(resultat.reglages.protectionMain.etat).toBe('fait');
  });

  it('reprend une création lancée avec l’ancienne méthode (dépôt généré depuis un dépôt modèle)', async () => {
    preparerCreation();
    const ancien = join(racine, 'ancien');
    git(racine, 'clone', '--quiet', distant, ancien);
    ecrire(join(ancien, 'PROJET.md'), '# __NOM_PROJET__');
    ecrire(join(ancien, 'obsolete.txt'), 'fichier de l’ancien modèle');
    git(ancien, 'add', '-A');
    git(ancien, 'commit', '--quiet', '-m', 'Initial commit');
    git(ancien, 'push', '--quiet', 'origin', 'HEAD:main');
    gh.repos.get.mockResolvedValue({ data: { ...depot('l-annuaire', []), template_repository: { name: 'modele-vue-nest' } } });

    await service.creer('jeton', 'proprio', projetValide);
    expect(fichiersPousses(distant)).toEqual([...SKILLS_LIVREES, 'PROJET.md', 'ada.json', 'front/src/App.vue']);
    expect(git(distant, 'rev-list', '--count', 'main').trim()).toBe('2');
  });

  it('refuse toujours un dépôt existant qui n’est pas une création d’ADA en cours', async () => {
    gh.repos.get.mockResolvedValue({ data: { ...depot('l-annuaire', ['ada-studio']), template_repository: { name: 'modele-vue-nest' } } });
    await expect(service.creer('jeton', 'proprio', projetValide)).rejects.toBeInstanceOf(ConflictException);
    gh.repos.get.mockResolvedValue({ data: { ...depot('l-annuaire', []), template_repository: null } });
    await expect(service.creer('jeton', 'proprio', projetValide)).rejects.toBeInstanceOf(ConflictException);
    expect(gh.repos.createForAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('crée le projet même si GitHub refuse le réglage de fusion', async () => {
    preparerCreation();
    gh.repos.update.mockRejectedValueOnce({ status: 403 });
    await expect(service.creer('jeton', 'proprio', projetValide)).resolves.toBeDefined();
  });

  it('personnalise et protège main selon l’ada.json du modèle', async () => {
    preparerCreation();
    await service.creer('jeton', 'proprio', { ...projetValide, modele: 'maquette' });
    expect(lirePousse(distant, 'index.html')).toBe('<title>L’annuaire</title>');
    const regles = gh.request.mock.calls.find(([route]) => route === 'POST /repos/{owner}/{repo}/rulesets')![1] as { rules: { type: string; parameters?: { required_status_checks?: { context: string }[] } }[] };
    expect(regles.rules.find((r) => r.type === 'required_status_checks')!.parameters!.required_status_checks).toEqual([{ context: 'Maquette (tests)' }]);
  });

  it('signale au PO les réglages que GitHub refuse (compte gratuit, organisation)', async () => {
    preparerCreation();
    gh.request.mockRejectedValue({ status: 403 });
    const resultat = await service.creer('jeton', 'proprio', projetValide);
    expect(resultat.reglages).toEqual({
      versionsAutomatiques: { etat: 'a-faire', lien: 'https://github.com/proprio/l-annuaire/settings/actions' },
      protectionMain: { etat: 'a-faire', lien: 'https://github.com/proprio/l-annuaire/settings/rules' },
    });
  });

  it('ne laisse aucune copie de travail derrière lui', async () => {
    preparerCreation();
    const avant = readFileSync(join(dossierCatalogue, 'vue-nest', 'PROJET.md'), 'utf8');
    await service.creer('jeton', 'proprio', projetValide);
    expect(readFileSync(join(dossierCatalogue, 'vue-nest', 'PROJET.md'), 'utf8')).toBe(avant);
  });

  it('n’ajoute le chart de déploiement que si le PO prévoit de déployer le projet', async () => {
    preparerCreation();
    await service.creer('jeton', 'proprio', { ...projetValide, modele: 'vue-node' });
    expect(fichiersPousses(distant)).toEqual([...SKILLS_LIVREES, 'Dockerfile', 'ada.json']);
  });

  it('projet déployé : chart Helm ajouté et personnalisé', async () => {
    preparerCreation();
    await service.creer('jeton', 'proprio', { ...projetValide, modele: 'vue-node', deploye: true });
    expect(fichiersPousses(distant)).toEqual([...SKILLS_LIVREES, 'Dockerfile', 'ada.json', 'charts/app/Chart.yaml', 'charts/app/templates/deployment.yaml']);
    expect(lirePousse(distant, 'charts/app/Chart.yaml')).toBe('name: l-annuaire');
  });

  describe('protection de la branche principale, vérifiée à l’ouverture d’un projet', () => {
    const CONTROLES = ['Anti-fuite (gitleaks)', 'Application mobile (lint, types, tests dont accessibilité, compilation)'];
    const adaJson = Buffer.from(JSON.stringify({ type: 'mobile', edition: 'studio', controlesRequis: CONTROLES, controles: ['npm test'], apercu: { principal: 'npx vite' } })).toString('base64');
    /** GitHub simulé : règles en vigueur sur main, réponse à la création de la règle. */
    function github(options: { regles?: unknown[]; prive?: boolean; topics?: string[]; refus?: { status: number; message: string } } = {}) {
      gh.repos.get.mockResolvedValue({ data: { default_branch: 'main', private: options.prive ?? false, topics: options.topics ?? ['ada-studio'] } });
      gh.repos.getContent.mockResolvedValue({ data: { content: adaJson } });
      gh.request.mockImplementation(async (route: string) => {
        if (route === 'GET /repos/{owner}/{repo}/rules/branches/{branch}') return { data: options.regles ?? [] };
        if (route === 'GET /repos/{owner}/{repo}/rulesets') return { data: [] };
        if (route === 'POST /repos/{owner}/{repo}/rulesets') {
          if (options.refus) throw Object.assign(new Error(options.refus.message), { status: options.refus.status, request: { method: 'POST', url: route } });
          return { data: { id: 1 } };
        }
        return { data: [] };
      });
    }
    const poses = () => gh.request.mock.calls.filter(([route]) => route === 'POST /repos/{owner}/{repo}/rulesets');

    it('pose la règle qui manque (PR et contrôles d’ada.json obligatoires), une seule fois', async () => {
      github();
      expect(await service.assurerProtection('jeton', 'gladys')).toMatchObject({ etat: 'posee', raison: null });
      expect(poses()).toHaveLength(1);
      const corps = poses()[0]![1] as { rules: { type: string; parameters?: { required_status_checks?: { context: string }[] } }[] };
      expect(corps.rules.map((regle) => regle.type)).toEqual(['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']);
      expect(corps.rules[3]!.parameters!.required_status_checks!.map((controle) => controle.context)).toEqual(CONTROLES);
      await service.assurerProtection('jeton', 'gladys'); // rouvert aussitôt : on ne redemande pas GitHub
      expect(poses()).toHaveLength(1);
    });

    it('ne pose rien quand une règle exige déjà une PR sur main', async () => {
      github({ regles: [{ type: 'pull_request' }, { type: 'deletion' }] });
      expect((await service.assurerProtection('jeton', 'gladys')).etat).toBe('protegee');
      expect(poses()).toHaveLength(0);
    });

    it('projet repris sans règle : ADA propose de protéger la branche, sans rien poser d’elle-même', async () => {
      github({ topics: ['ada-studio', 'ada-studio-reprise'] });
      expect((await service.assurerProtection('jeton', 'secret-santa')).etat).toBe('a-proposer');
      expect(poses()).toHaveLength(0);
    });

    it('projet repris déjà protégé par une règle de son équipe : rien à proposer', async () => {
      github({ topics: ['ada-studio', 'ada-studio-reprise'], regles: [{ type: 'pull_request' }] });
      expect((await service.assurerProtection('jeton', 'secret-santa')).etat).toBe('protegee');
      expect(poses()).toHaveLength(0);
    });

    it('le PO accepte : ADA pose la règle, avec les contrôles d’ada.json', async () => {
      github({ topics: ['ada-studio', 'ada-studio-reprise'] });
      expect((await service.assurerProtection('jeton', 'secret-santa')).etat).toBe('a-proposer');
      expect(await service.protegerSurDemande('jeton', 'secret-santa', 'po1')).toMatchObject({ etat: 'posee' });
      expect(poses()).toHaveLength(1);
      const corps = poses()[0]![1] as { rules: { type: string; parameters?: { required_status_checks?: { context: string }[] } }[] };
      expect(corps.rules.find((regle) => regle.type === 'required_status_checks')!.parameters!.required_status_checks!.map((controle) => controle.context)).toEqual(CONTROLES);
      expect((await service.assurerProtection('jeton', 'secret-santa')).etat).toBe('posee'); // l'écran se met à jour aussitôt
    });

    it('le PO refuse : ADA le retient (même après un redémarrage) et ne redemande plus', async () => {
      github({ topics: ['ada-studio', 'ada-studio-reprise'] });
      expect(await service.refuserProtection('secret-santa', 'po1')).toMatchObject({ etat: 'refusee' });
      const apresRedemarrage = new ProjetsService(config, { client: () => gh } as unknown as GithubService, apercu);
      expect((await apresRedemarrage.assurerProtection('jeton', 'secret-santa')).etat).toBe('refusee');
      expect(poses()).toHaveLength(0);
    });

    it('le PO revient sur son refus et accepte : la règle est posée et le refus oublié', async () => {
      github({ topics: ['ada-studio', 'ada-studio-reprise'] });
      await service.refuserProtection('secret-santa', 'po1');
      expect((await service.protegerSurDemande('jeton', 'secret-santa', 'po1')).etat).toBe('posee');
      github({ topics: ['ada-studio', 'ada-studio-reprise'] }); // la règle n'est pas encore visible : le refus ne doit plus revenir
      expect((await new ProjetsService(config, { client: () => gh } as unknown as GithubService, apercu).assurerProtection('jeton', 'secret-santa')).etat).toBe('a-proposer');
    });

    it('le PO accepte mais GitHub refuse : la raison est donnée, le choix reste ouvert', async () => {
      github({ topics: ['ada-studio', 'ada-studio-reprise'], prive: true, refus: { status: 403, message: 'Upgrade to GitHub Pro' } });
      expect(await service.protegerSurDemande('jeton', 'secret-santa', 'po1')).toMatchObject({ etat: 'impossible', raison: expect.stringContaining('dépôt privé') });
    });

    it('dépôt privé sur un compte gratuit : le dit clairement au PO, et ne réessaie pas à chaque ouverture', async () => {
      github({ prive: true, refus: { status: 403, message: 'Upgrade to GitHub Pro or make this repository public to enable this feature.' } });
      expect(await service.assurerProtection('jeton', 'signalements')).toMatchObject({
        etat: 'impossible',
        raison: 'GitHub ne permet pas de protéger un dépôt privé sur un compte personnel gratuit.',
        lien: 'https://github.com/proprio/signalements/rules',
      });
      await service.assurerProtection('jeton', 'signalements');
      expect(poses()).toHaveLength(1);
    });

    it('autre refus : donne le motif exact de GitHub (pour pouvoir le corriger)', async () => {
      github({ refus: { status: 422, message: 'Invalid rule \'pull_request\': unknown parameter' } });
      expect((await service.assurerProtection('jeton', 'gladys')).raison).toBe("GitHub a refusé la règle (422) : Invalid rule 'pull_request': unknown parameter.");
    });

    it('lit les contrôles que la règle de GitHub exige ; aucun : null', async () => {
      github({ regles: [{ type: 'pull_request' }, { type: 'required_status_checks', parameters: { required_status_checks: CONTROLES.map((context) => ({ context })) } }] });
      expect(await service.controlesExiges(gh as never, 'proprio', 'gladys', 'main')).toEqual(CONTROLES);
      github({ regles: [{ type: 'pull_request' }] });
      expect(await service.controlesExiges(gh as never, 'proprio', 'gladys', 'main')).toBeNull();
    });
  });
});
