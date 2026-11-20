/** Ce que l'agent a le droit de faire, et ce qui lui reste interdit quelle que soit la phase. */
import type { Phase } from './agent.js';

/** Commande exécutée dans le conteneur de l'aperçu (depuis le dépôt cloné), en utilisateur non privilégié (1000 : « node » ou « ada » selon l'image). */
export const DANS_CONTENEUR = 'docker compose -f ../compose.yml exec -T -u 1000 app bash -lc';

/**
 * Outils autorisés par phase, limités au projet (répertoire courant) : l'agent ne peut ni lire
 * ni écrire ailleurs sur le poste. Seuls les dossiers des skills sont lisibles en plus (chemins
 * réels, préfixe « // » = chemin absolu). Ni push, ni commande hors du conteneur.
 */
export function outilsAutorises(phase: Phase, dossiersLisibles: string[] = []): string[] {
  const lecture = ['Read(./**)', 'Glob(./**)', 'Grep(./**)', ...dossiersLisibles.map((dossier) => `Read(/${dossier}/**)`)];
  if (phase === 'analyse' || phase === 'reprise') return ['Skill', ...lecture];
  return [
    'Skill',
    ...lecture,
    'Edit(./**)',
    'Write(./**)',
    `Bash(${DANS_CONTENEUR} *)`,
    // Formes exactes (sans « * » collé au mot) : « git diff* » accepterait aussi « git difftool ».
    'Bash(git status)',
    'Bash(git status *)',
    'Bash(git diff)',
    'Bash(git diff *)',
    'Bash(git add *)',
    // Supprimer ou renommer un fichier du projet (une page retirée, par exemple) : git refuse tout
    // chemin hors du dépôt ; .github/ et charts/ restent protégés par cheminsReserves avant l'envoi.
    'Bash(git rm *)',
    'Bash(git mv *)',
    'Bash(git commit *)',
    'Bash(git log)',
    'Bash(git log *)',
  ];
}

/**
 * Interdits, quelle que soit la phase : ce qui est réservé aux développeurs (la CI et les versions
 * dans .github, le déploiement dans charts) et les réglages de l'agent lui-même. Une interdiction
 * l'emporte sur une autorisation.
 */
export const OUTILS_INTERDITS = [
  'Edit(./.github/**)',
  'Write(./.github/**)',
  'Edit(./charts/**)',
  'Write(./charts/**)',
  // Réglages et outils de l'agent : jamais modifiables par lui (les skills d'ADA y sont reliées).
  'Edit(./.claude/**)',
  'Write(./.claude/**)',
  'Edit(./.agents/**)',
  'Write(./.agents/**)',
  'Edit(./.mcp.json)',
  'Write(./.mcp.json)',
  // git peut lire ou écrire hors du projet par ces options : « diff --no-index » compare deux
  // fichiers quelconques du poste, « --output » écrit où on veut, « commit -F » reprend un fichier
  // quelconque comme message (qui part ensuite sur GitHub).
  'Bash(git diff --no-index*)',
  'Bash(git diff*--output*)',
  'Bash(git log*--output*)',
  'Bash(git commit*--file*)',
  'Bash(git commit* -F*)',
  'Bash(git commit*--template*)',
];

/**
 * Isolement de l'agent : il ne lit que les réglages de l'utilisateur du serveur, jamais ceux du
 * dépôt du PO (`.claude/settings.json` d'un projet repris : hooks, permissions élargies), et ne
 * charge aucun serveur MCP venu du dépôt (`.mcp.json`).
 */
export const OPTIONS_ISOLEMENT = ['--setting-sources', 'user', '--strict-mcp-config'];

/**
 * Chemins réservés : la CI, les versions et le déploiement (réservés aux développeurs), et les
 * réglages de l'agent lui-même (skills, permissions, serveurs MCP). Les interdits d'outils ne
 * couvrent que l'édition directe ; depuis le conteneur, l'agent écrit où il veut dans le dépôt
 * monté : un fichier d'instructions glissé dans une PR agirait sur toutes les demandes suivantes.
 */
const DOSSIERS_RESERVES = ['.github/', 'charts/', '.claude/', '.agents/', '.mcp.json'];

/** Fichiers modifiés, ajoutés ou supprimés dans un chemin réservé : la branche ne doit pas partir. */
export function cheminsReserves(fichiers: string[]): string[] {
  return fichiers.filter((fichier) => DOSSIERS_RESERVES.some((dossier) => fichier.trim().startsWith(dossier)));
}

/** Une skill qui pré-autorise des outils ou exécute des commandes au chargement casserait ce cloisonnement. */
export function skillSure(contenuSkill: string): boolean {
  const entete = contenuSkill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  return !/^allowed-tools:/m.test(entete) && !/!`/.test(contenuSkill);
}
