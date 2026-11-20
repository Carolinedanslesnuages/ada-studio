import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(5701),
  /** URL publique de l'interface (front), utilisée pour les redirections OAuth. */
  URL_INTERFACE: z.string().url().default('http://localhost:5700'),
  /** Compte personnel ou organisation GitHub qui possède les dépôts des POC. */
  GITHUB_PROPRIETAIRE: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET : 32 caractères minimum'),
  /**
   * Comptes GitHub autorisés à se connecter, séparés par des virgules.
   * Vide : seul GITHUB_PROPRIETAIRE (cas d'un compte personnel). Obligatoire pour une organisation.
   */
  LOGINS_AUTORISES: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((l) => l.trim().toLowerCase()).filter(Boolean)),
  /** Dossier des modèles de projet (défaut : `catalogue/` à la racine du dépôt d'ADA). */
  CATALOGUE: z.string().default(''),
  /** Dossier des skills `po-` livrées dans chaque projet créé (défaut : `skills/po/` à la racine du dépôt d'ADA). */
  SKILLS_PO: z.string().default(''),
  /**
   * Commande de l'agent de code (mode non interactif, sortie stream-json). Vide : agent désactivé.
   * Démo : l'exécutable Claude Code. Remplaçable par un autre agent (voir src/agent/agent.ts).
   */
  AGENT_COMMANDE: z.string().default(''),
  /**
   * Agents qui travaillent en même temps sur toute la machine (un par projet au plus). Les
   * suivants attendent leur tour dans une file : chaque agent mobilise un conteneur et un processeur.
   */
  AGENT_MAX_SIMULTANES: z.coerce.number().int().min(1).default(3),
  /**
   * Modèle de l'agent (option --model) : un alias (« sonnet », « opus », « haiku ») ou un nom
   * complet. Vide : le modèle par défaut du compte de l'agent.
   */
  AGENT_MODELE: z.string().trim().default(''),
  /**
   * Skills mises à disposition de l'assistant (chemins de dossiers contenant un SKILL.md,
   * séparés par des virgules) : reliées dans le projet avant chaque exécution, jamais commitées.
   */
  AGENT_SKILLS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((chemin) => chemin.trim()).filter(Boolean)),
  /** Index du référentiel RGAA (DINUM) joint à chaque consigne de l'assistant. */
  RGAA_INDEX: z.string().default('../../skills/po/po-story/references/rgaa-4.1.2/README.md'),
  /** Sessions chiffrées sur disque (hors git) : un redémarrage ne déconnecte personne. */
  DOSSIER_SESSIONS: z.string().default('../sessions'),
  /** Registre des projets créés ou repris par ADA (fichier, hors git) : les indicateurs comptent
   * aussi les projets archivés ou supprimés depuis, que GitHub ne connaît plus. */
  DOSSIER_REGISTRE: z.string().default('../registre'),
  /** Dossier de travail des aperçus (clones et conteneurs), hors de tout dépôt git. */
  DOSSIER_APERCUS: z.string().default('../apercus'),
  /**
   * Adresse publique des liens de démonstration, `{projet}` et `{port}` remplacés. En ligne :
   * un proxy (domaine générique) renvoie vers le port de chaque démo, ex.
   * https://{projet}.demo.exemple.fr. Par défaut : la machine d'ADA studio.
   */
  URL_DEMO: z.string().default('http://localhost:{port}'),
  /** Sujet GitHub (topic) des projets d'ADA studio : jamais celui de l'ADA du travail (« ada »). */
  TOPIC_ATELIER: z.string().default('ada-studio'),
});

export type Config = z.infer<typeof schema>;

export function lireConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const resultat = schema.safeParse(env);
  if (!resultat.success) {
    const details = resultat.error.issues
      .map((i) => `  - ${i.path.join('.')} : ${i.message}`)
      .join('\n');
    throw new Error(`Configuration incomplète (voir api/.env.example) :\n${details}`);
  }
  return resultat.data;
}

export const CONFIG = Symbol('CONFIG');

export function loginAutorise(config: Config, login: string): boolean {
  const liste = config.LOGINS_AUTORISES.length
    ? config.LOGINS_AUTORISES
    : [config.GITHUB_PROPRIETAIRE.toLowerCase()];
  return liste.includes(login.toLowerCase());
}
