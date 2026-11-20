import { readFile } from 'node:fs/promises';
import { EDITION } from '../edition/edition.js';
import { join } from 'node:path';
import type { Octokit } from '@octokit/rest';
import { lireAdaConfig, type AdaConfig } from '../ada/ada-config.js';

/**
 * Reprise d'un projet existant (#37, ADR-0010) : règles et écritures GitHub partagées par
 * RepriseService (demande du PO) et l'assistant (qui ouvre la PR à la fin de son analyse).
 */

/** Topic posé par une reprise (#37) : le projet entre dans ADA quand sa PR de reprise est fusionnée. */
export const TOPIC_REPRISE = 'ada-studio-reprise';

/** Branche et titre de la PR de reprise (Conventional Commits : `chore`, sans nouvelle version). */
export const BRANCHE_REPRISE = 'ada/reprise';
export const TITRE_REPRISE = 'chore: reprise du projet par ADA';
/**
 * Contrôles exigés : ceux qu'ajoute la reprise (titre de PR, taille des fichiers). La CI du projet
 * reste la sienne. Un fichier déjà trop long est toléré tant qu'il ne grossit pas.
 */
export const CONTROLE_TITRE = 'Titre de PR (Conventional Commits, semver)';
export const CONTROLE_TAILLE = 'Taille des fichiers (une responsabilité par fichier)';
/** Modèle dont viennent les fichiers communs (identiques dans tous les modèles, vérifié en CI). */
export const MODELE_REFERENCE = 'vue-node';

/**
 * Fichiers qu'ADA apporte à un projet repris, s'ils n'y sont pas déjà : formulaires de story et de
 * signalement, vérification du titre des PR et de la taille des fichiers, versions par release-please. `ada.json` est toujours
 * proposé (il décrit l'aperçu) ; rien d'autre n'est touché.
 */
export const FICHIERS_REPRISE = [
  '.github/ISSUE_TEMPLATE/user-story.yml',
  '.github/ISSUE_TEMPLATE/bug.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/workflows/titre-pr.yml',
  '.github/workflows/taille-fichiers.yml',
  '.github/workflows/release-please.yml',
  'release-please-config.json',
  '.release-please-manifest.json',
  'version.txt',
];

const statut = (e: unknown) => (e as { status?: number }).status;

/**
 * Projet sans écran (script, traitement de données…) : l'aperçu sert simplement les fichiers du
 * projet (README, résultats), pour que le projet entre quand même dans ADA. python3 est présent
 * dans les images d'aperçu d'ADA (node:24-bookworm comme python:3.13-slim).
 */
export const APERCU_SANS_ECRAN = { principal: 'cd /app && python3 -m http.server 8000 --bind 0.0.0.0', port: 8000 } as const;

/**
 * Aperçu sans commande pour servir une page : celui d'un projet sans écran. Une commande sans port
 * reste telle quelle (le port ne se devine pas) : la validation la refusera, un développeur tranche.
 */
function completerApercu(apercu: unknown): Record<string, unknown> {
  const actuel = apercu && typeof apercu === 'object' && !Array.isArray(apercu) ? (apercu as Record<string, unknown>) : {};
  const sansCommande = typeof actuel.principal !== 'string' || !actuel.principal.trim();
  return sansCommande ? { ...actuel, ...APERCU_SANS_ECRAN } : actuel;
}

/**
 * ada.json d'un projet repris, à partir de celui que propose l'analyse (ou du modèle choisi) :
 * aucun fichier à personnaliser, seuls les contrôles ajoutés par la reprise exigés, pas de chart,
 * édition « studio », et l'apparence du projet gardée (ni style ni bibliothèque imposés). Lève une erreur si la description de l'aperçu est invalide.
 */
export function adaJsonReprise(brut: unknown): string {
  const base = typeof brut === 'string' ? (JSON.parse(brut) as unknown) : brut;
  if (!base || typeof base !== 'object' || Array.isArray(base)) throw new Error('ada.json absent');
  const lu = base as Record<string, unknown>;
  const ada = { ...lu, apercu: completerApercu(lu.apercu), personnaliser: [], controlesRequis: [CONTROLE_TITRE, CONTROLE_TAILLE], deploiement: null, edition: EDITION, style: null, composants: null, interface: null };
  const valide: AdaConfig = lireAdaConfig(JSON.stringify(ada));
  return `${JSON.stringify({ ...ada, apercu: valide.apercu, type: valide.type, controles: valide.controles }, null, 2)}\n`;
}

export function corpsReprise(options: { stack: string | null; fichiers: string[]; login: string; analyse: string | null }): string {
  return [
    `Reprise du projet par ADA, demandée par @${options.login}.`,
    options.stack ? `Stack la plus proche indiquée : **${options.stack}**.` : 'Aperçu décrit par l’analyse du projet.',
    'Apparence : **celle du projet** ; ADA studio n’ajoute aucune bibliothèque de composants ni de style.',
    ...(options.analyse ? ['', `Analyse et améliorations proposées : ${options.analyse}`] : []),
    '',
    'Fichiers ajoutés (ceux déjà présents ne sont pas modifiés) :',
    ...options.fichiers.map((fichier) => `- \`${fichier}\``),
    '',
    'Une fois cette PR fusionnée, le projet apparaît dans ADA : stories, aperçu et versions.',
    '',
    '`ada.json` décrit comment ADA démarre l’aperçu. Si l’aperçu ne démarre pas après la reprise, un développeur l’ajuste à la structure du projet.',
    '',
    '🤖 Proposée par ADA',
  ].join('\n');
}

export async function prReprise(gh: Octokit, owner: string, repo: string): Promise<string | null> {
  const { data } = await gh.pulls.list({ owner, repo, head: `${owner}:${BRANCHE_REPRISE}`, state: 'open', per_page: 1 });
  return data[0]?.html_url ?? null;
}

async function existe(gh: Octokit, owner: string, repo: string, path: string): Promise<boolean> {
  try {
    await gh.repos.getContent({ owner, repo, path, ref: 'main' });
    return true;
  } catch (e) {
    if (statut(e) === 404) return false;
    throw e;
  }
}

/** Fichiers communs absents de main (lus dans `dossierModele`), plus ada.json (toujours proposé). */
export async function fichiersAApporter(gh: Octokit, owner: string, repo: string, dossierModele: string, adaJson: string): Promise<Map<string, string>> {
  const fichiers = new Map<string, string>();
  for (const chemin of FICHIERS_REPRISE) {
    if (await existe(gh, owner, repo, chemin)) continue;
    fichiers.set(chemin, await readFile(join(dossierModele, chemin), 'utf8'));
  }
  fichiers.set('ada.json', adaJson);
  return fichiers;
}

/** Un commit au nom du PO sur `ada/reprise`, depuis main (branche recréée si elle existait). */
async function pousserBranche(gh: Octokit, owner: string, repo: string, fichiers: Map<string, string>, login: string): Promise<void> {
  const { data: main } = await gh.git.getRef({ owner, repo, ref: 'heads/main' });
  const { data: commitMain } = await gh.git.getCommit({ owner, repo, commit_sha: main.object.sha });
  const { data: arbre } = await gh.git.createTree({
    owner,
    repo,
    base_tree: commitMain.tree.sha,
    tree: [...fichiers].map(([path, content]) => ({ path, mode: '100644' as const, type: 'blob' as const, content })),
  });
  const { data: commit } = await gh.git.createCommit({
    owner,
    repo,
    message: TITRE_REPRISE,
    tree: arbre.sha,
    parents: [main.object.sha],
    author: { name: login, email: `${login}@users.noreply.github.com` },
  });
  try {
    await gh.git.createRef({ owner, repo, ref: `refs/heads/${BRANCHE_REPRISE}`, sha: commit.sha });
  } catch (e) {
    if (statut(e) !== 422) throw e; // la branche existe (reprise interrompue) : on la remplace
    await gh.git.updateRef({ owner, repo, ref: `heads/${BRANCHE_REPRISE}`, sha: commit.sha, force: true });
  }
}

/** Branche `ada/reprise` puis PR vers main ; rien n'arrive sur main sans la fusion du PO. */
export async function ouvrirPrReprise(
  gh: Octokit,
  cible: { owner: string; repo: string; login: string },
  fichiers: Map<string, string>,
  corps: string,
): Promise<string> {
  const { owner, repo, login } = cible;
  const deja = await prReprise(gh, owner, repo);
  if (deja) return deja;
  await pousserBranche(gh, owner, repo, fichiers, login);
  const { data: pr } = await gh.pulls.create({ owner, repo, head: BRANCHE_REPRISE, base: 'main', title: TITRE_REPRISE, body: corps });
  return pr.html_url;
}
