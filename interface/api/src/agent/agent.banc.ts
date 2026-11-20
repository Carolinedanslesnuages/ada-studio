/**
 * Banc d'essai des tests de l'agent : AgentService monté avec un faux GitHub, un faux aperçu, de
 * fausses stories et un faux agent dont la sortie se règle test par test. Partagé par les fichiers
 * *.spec.ts du dossier ; jamais compilé dans l'application (tsconfig.build.json).
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { ADA_PAR_DEFAUT } from '../ada/ada-config.js';
import type { ApercuService } from '../apercu/apercu.service.js';
import { lireConfig } from '../config.js';
import type { GithubService } from '../github/github.service.js';
import type { ProjetsService } from '../projets/projets.service.js';
import { FICHIERS_REPRISE } from '../projets/reprise.js';
import type { StoriesService } from '../stories/stories.service.js';
import { AgentService } from './agent.service.js';
import type { LancerAgent } from './lancement.js';

export const JETON = 'jeton-du-po';
/** Journal d'empreinte des tests : jamais celui d'ADA. */
export const REGISTRE_ESSAI = mkdtempSync(join(tmpdir(), 'registre-'));
export const config = (agent = '/bin/agent') =>
  lireConfig({
    GITHUB_PROPRIETAIRE: 'proprio',
    GITHUB_CLIENT_ID: 'Iv',
    GITHUB_CLIENT_SECRET: 's',
    SESSION_SECRET: 'x'.repeat(32),
    AGENT_COMMANDE: agent,
    DOSSIER_REGISTRE: REGISTRE_ESSAI,
  });

export const resultat = (texte: string) => JSON.stringify({ type: 'result', subtype: 'success', result: texte });
export const action = (name: string, input: Record<string, unknown>) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });

/** Catalogue minimal pour la reprise (#37) : fichiers communs et ada.json du modèle de référence. */
const catalogueReprise = mkdtempSync(join(tmpdir(), 'agent-catalogue-'));
for (const fichier of [...FICHIERS_REPRISE, 'ada.json']) {
  mkdirSync(join(catalogueReprise, 'vue-node', fichier, '..'), { recursive: true });
  writeFileSync(join(catalogueReprise, 'vue-node', fichier), fichier === 'ada.json' ? JSON.stringify(ADA_PAR_DEFAUT) : `contenu de ${fichier}`);
}
export const projets = {
  dossierCatalogue: catalogueReprise,
  modeles: () => ({
    modeles: [
      { id: 'vue-node', type: 'service', libelle: 'Vue 3 + Node.js (Express)', pourQuoi: 'Petite application', disponible: true },
      { id: 'django', type: 'gestion', libelle: 'Python (Django)', pourQuoi: 'Back-office', disponible: false },
    ],
    types: [{ id: 'service', libelle: 'Application en ligne', description: 'Des écrans et des règles' }],
  }),
};

/** La story de test, au statut donné. */
export const detailEssai = (statut: string) => ({
  numero: 1,
  titre: 'Page d’accueil',
  type: 'story',
  statut,
  contenu: { role: 'agent', besoin: 'voir ma journée', benefice: 'm’organiser', criteres: ['titre'] },
  contenuBug: null,
  contenuLibre: null,
  messages: [
    { id: 1, auteur: 'po', texte: 'Discussion avant lancement', le: '' },
    { id: 2, auteur: 'po', texte: '▶️ Lancée depuis ADA par po1.', le: '' },
    { id: 3, auteur: 'po', texte: '<!-- ada-studio:assistant -->\n🤖 **Plan proposé**\n\nJe vais…', le: '' },
    { id: 4, auteur: 'po', texte: 'D’accord', le: '' },
  ],
});

type Simulacre = ReturnType<typeof vi.fn>;
export interface FauxApercu {
  projetsAvecAgent: Simulacre;
  noterUtilisation: Simulacre;
  estEnVeille: Simulacre;
  demarrer: Simulacre;
  relancerApplication: Simulacre;
  lireConfig: Simulacre;
  cheminDepot: Simulacre;
  preparerDepot: Simulacre;
  executer: Simulacre;
  environnementGit: Simulacre;
}

/** Ce que chaque test règle à sa guise : lu par les faux au moment de l'appel. */
export interface Reglages {
  sortie: () => string[];
  statut: () => string;
  changerStatut: (statut: string) => void;
  commits: () => string;
}

/** Monte le banc (à appeler dans un beforeEach) : dossier de travail neuf, faux tout neufs. */
export function preparerBanc(reglages: Reglages) {
  const racine = mkdtempSync(join(tmpdir(), 'agent-'));
  const stories: Record<string, Simulacre> = {
    detail: vi.fn(async () => detailEssai(reglages.statut())),
    lister: vi.fn(async () => [{ numero: 30, titre: 'Service', type: 'story', statut: 'parent', fermeeLe: null, parent: null }, { numero: 31, titre: 'Envoyer les e-mails', type: 'story', fermeeLe: null, parent: 30 }, { numero: 1, titre: 'Moi-même', type: 'story', fermeeLe: null }]),
    // L'agent lit la demande figée et le journal d'ADA : ici, ce que « detail » décrit à cet instant.
    demandeFigee: vi.fn(async (...args: unknown[]) => {
      const d = (await (stories.detail as (...a: unknown[]) => Promise<ReturnType<typeof detailEssai>>)(...args)) as ReturnType<typeof detailEssai>;
      return {
        fige: { numero: d.numero, titre: d.titre, type: d.type, contenu: d.contenu, contenuBug: d.contenuBug, contenuLibre: d.contenuLibre, parent: null, lanceeLe: '', lanceePar: 'po1' },
        messages: d.messages,
      };
    }),
    commenterAssistant: vi.fn(async () => undefined),
    changerStatut: vi.fn(async (_j: string, _d: string, _n: number, s: string) => {
      reglages.changerStatut(s);
    }),
    repondre: vi.fn(async () => ({})),
  };
  const apercu: FauxApercu = {
    projetsAvecAgent: vi.fn(async (): Promise<string[]> => []),
    noterUtilisation: vi.fn(),
    estEnVeille: vi.fn(() => false),
    demarrer: vi.fn(async () => ({ etat: 'demarrage', url: null, journal: null })),
    relancerApplication: vi.fn(async () => {}),
    lireConfig: vi.fn(async () => ADA_PAR_DEFAUT),
    cheminDepot: vi.fn((projet: string) => join(racine, projet, 'depot')),
    preparerDepot: vi.fn(async (_j: string, projet: string) => join(racine, projet, 'depot')),
    environnementGit: vi.fn(() => ({ GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic secret' })),
    executer: vi.fn(async (_c: string, args: string[]) => ({
      stdout: args.includes('rev-list') ? `${reglages.commits()}\n` : args.includes('rev-parse') ? 'main\n' : '',
    })),
  };
  const gh = {
    pulls: { create: vi.fn(async () => ({ data: { html_url: 'https://github.com/proprio/poc/pull/2' } })) },
    repos: { get: vi.fn(async ({ repo }: { repo: string }) => ({ data: { name: repo } })) },
  };
  const service = new AgentService(
    { ...config(), DOSSIER_APERCUS: racine },
    { client: () => gh } as unknown as GithubService,
    stories as unknown as StoriesService,
    apercu as unknown as ApercuService,
    projets as unknown as ProjetsService,
  );
  const lancer = vi.fn<LancerAgent>(async (_args, _cwd, surLigne) => {
    reglages.sortie().forEach(surLigne);
    return 0;
  });
  service.lancerAgent = lancer;
  return { racine, stories, apercu, gh, service, lancer };
}
