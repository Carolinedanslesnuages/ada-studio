import { z } from 'zod';
import { EDITION, MESSAGE_AUTRE_EDITION } from '../edition/edition.js';

/**
 * Description d'un modèle de projet (fichier `ada.json` à la racine du dépôt) : son type, comment
 * le lancer dans l'aperçu, quels fichiers personnaliser, quels contrôles exiger. ADA s'adapte ainsi
 * à n'importe quelle stack sans supposer « front + API NestJS + PostgreSQL ».
 */
export const TYPES_PROJET = [
  'service',
  'formulaire',
  'tableau-de-bord',
  'gestion',
  'site',
  'documentation',
  'carte',
  'mobile',
  'formation',
  'extension',
  'composant',
  'api',
  'traitement',
  'maquette',
] as const;
export type TypeProjet = (typeof TYPES_PROJET)[number];

/**
 * `ada.json` vient du dépôt du PO, que l'agent (ou un dépôt repris) peut modifier : ses valeurs
 * finissent dans `compose.yml` et dans des scripts shell. Les champs qui y entrent comme
 * structure (image, dossiers) sont donc limités à une forme sûre : aucune espace ni retour à la
 * ligne, aucun « .. », aucun chemin absolu.
 */
const IMAGE = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*(:[A-Za-z0-9][A-Za-z0-9._-]{0,127})?$/;
const DOSSIER = /^(\.|(\.\/)?[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*)$/;
const dossier = z.string().max(200).regex(DOSSIER, 'un dossier du projet (api, front, . …), sans « .. » ni chemin absolu');

/** Valeurs possibles, identiques à variantes/combinaisons.json (vérifié par un test). */
export const STYLES = ['css-maison', 'tailwind', 'unocss'] as const;
export const COMPOSANTS = ['aucune', 'reka-ui', 'shadcn-vue', 'primevue', 'vuetify', 'naive-ui'] as const;
export type Style = (typeof STYLES)[number];
export type Composants = (typeof COMPOSANTS)[number];

const schema = z.object({
  type: z.enum(TYPES_PROJET),
  /** Fichiers contenant les marqueurs __NOM_PROJET__, __BASELINE__… à remplacer à la création. */
  personnaliser: z.array(z.string()).default([]),
  /** Noms des jobs de CI exigés avant fusion (protection de main, bouton « Valider et fusionner »). */
  controlesRequis: z.array(z.string()).min(1),
  /** Commandes du contrôle final, exécutées dans le conteneur de l'aperçu (une par partie du projet). */
  controles: z.array(z.string()).min(1),
  /** Édition d'ADA qui a créé ou repris le projet : « studio » seulement (voir edition.ts). */
  edition: z.string().optional(),
  /** Style choisi à la création (variantes/combinaisons.json) ; null : projet repris, apparence existante. */
  style: z.enum(STYLES).nullable().default(null),
  /** Bibliothèque de composants choisie à la création ; null : projet repris, composants existants. */
  composants: z.enum(COMPOSANTS).nullable().default(null),
  /** Partie front du modèle : son dossier, et s'il accepte les variantes de style et de composants. */
  interface: z.object({ dossier: dossier, variantes: z.boolean() }).nullable().default(null),
  /** Modèle déployable : dossier du chart Helm, ajouté au projet seulement si le PO le demande. */
  deploiement: z.object({ chart: z.string().min(1) }).nullable().default(null),
  apercu: z.object({
    image: z.string().max(200).regex(IMAGE, 'une image Docker (nom:version), sans espace ni retour à la ligne').default('node:24-bookworm'),
    /** Base de données de l'aperçu : PostgreSQL, ou aucune. */
    base: z.enum(['postgres']).nullable().default(null),
    /** Dossiers où lancer « npm install » (avec nouvelles tentatives), « . » pour la racine. */
    npm: z.array(dossier).default([]),
    /**
     * Dossiers contenant un requirements.txt (Python) : installés dans un environnement virtuel
     * (/opt/venv, conservé dans un volume), avec nouvelles tentatives.
     */
    pip: z.array(dossier).default([]),
    /** Commandes préalables (migrations, pip install…). */
    avant: z.array(z.string()).default([]),
    /** Commandes lancées en arrière-plan (ex. l'API). */
    arrierePlan: z.array(z.string()).default([]),
    /** Commande principale, au premier plan, qui sert la page affichée dans l'aperçu. */
    principal: z.string(),
    port: z.number().int().positive().default(5173),
  }),
});

export type AdaConfig = z.output<typeof schema>;

/** Comportement des projets créés avant ada.json (modèle Vue + NestJS + PostgreSQL). */
export const ADA_PAR_DEFAUT: AdaConfig = {
  type: 'service',
  edition: EDITION,
  style: null,
  composants: null,
  interface: null,
  deploiement: null,
  personnaliser: [
    'PROJET.md',
    'README.md',
    'AGENTS.md',
    'api/README.md',
    'docker-compose.yml',
    'docs/adr/0001-choix-de-la-stack.md',
    'docs/adr/README.md',
    'front/index.html',
    'front/src/App.vue',
    'front/src/views/HomeView.vue',
    'front/src/views/__tests__/HomeView.spec.ts',
  ],
  controlesRequis: [
    'Anti-fuite (gitleaks)',
    'API (lint, tests, compilation)',
    'Front (lint, types, tests dont accessibilité, compilation)',
  ],
  controles: [
    'cd /app/api && npm run lint && npm test && npm run test:e2e && npm run build',
    'cd /app/front && npx oxlint . && npx eslint . && npm run type-check && npm run test:unit -- --run && npm run build-only',
  ],
  apercu: {
    image: 'node:24-bookworm',
    base: 'postgres',
    pip: [],
    npm: ['api', 'front'],
    avant: ['cd /app/api && if [ -d prisma/migrations ]; then npx prisma migrate deploy; fi'],
    arrierePlan: ['cd /app/api && npm run start:dev'],
    principal: 'cd /app/front && npx vite --host 0.0.0.0 --port 5173 --strictPort',
    port: 5173,
  },
};

/** Projet d'une autre édition d'ADA : ADA studio refuse de l'ouvrir, et dit pourquoi. */
export class EditionIncompatible extends Error {
  constructor() {
    super(MESSAGE_AUTRE_EDITION);
  }
}

/**
 * Lit un ada.json ; absent → comportement par défaut (reprise en cours) ; invalide → erreur
 * explicite ; écrit par une autre édition d'ADA (« edition » absente ou différente) → refus.
 */
export function lireAdaConfig(contenu: string | null): AdaConfig {
  if (contenu === null) return ADA_PAR_DEFAUT;
  const resultat = schema.safeParse(JSON.parse(contenu));
  if (!resultat.success) {
    throw new Error(`ada.json invalide : ${resultat.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')}`);
  }
  if (resultat.data.edition !== EDITION) throw new EditionIncompatible();
  return resultat.data;
}

/** Apparence imposée à l'agent : le style et la bibliothèque choisis, ou rien (projet repris). */
export type Apparence = Pick<AdaConfig, 'style' | 'composants'>;
export const APPARENCE_EXISTANTE: Apparence = { style: null, composants: null };
