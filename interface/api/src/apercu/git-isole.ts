import { existsSync, statSync } from 'node:fs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/**
 * Le dépôt d'un projet est monté dans le conteneur de l'aperçu (`./depot:/app`), où l'agent lance
 * des commandes libres. Si son `.git` s'y trouvait, ces commandes pourraient y poser un hook ou un
 * réglage (`core.fsmonitor`, filtres…) que git exécuterait ensuite SUR LE SERVEUR, avec les droits
 * et l'environnement de l'API. Le dossier git est donc rangé à côté du dépôt (`<projet>/git`),
 * hors du dossier monté, et chaque appel de git sur le serveur le désigne explicitement : même un
 * fichier `.git` réécrit depuis le conteneur n'est plus lu.
 */
const NOM_DEPOT = 'depot';
const NOM_GIT = 'git';

/** Dossier git rangé à côté d'un dépôt (`…/depot` → `…/git`), ou null si ce n'est pas un dépôt d'aperçu. */
export function dossierGitDe(depot: string): string | null {
  return basename(depot) === NOM_DEPOT ? join(dirname(depot), NOM_GIT) : null;
}

/** Réglages imposés à git sur le serveur : jamais de hook ni de moniteur de fichiers lancé par un dépôt. */
const REGLAGES_IMPOSES: [string, string][] = [
  ['core.hooksPath', '/dev/null'],
  ['core.fsmonitor', 'false'],
];

/** Ajoute des réglages via GIT_CONFIG_COUNT/KEY/VALUE, sans écraser ceux déjà présents (jeton du PO). */
function avecReglages(env: NodeJS.ProcessEnv, reglages: [string, string][]): NodeJS.ProcessEnv {
  const suite: NodeJS.ProcessEnv = { ...env };
  const depart = Number(env.GIT_CONFIG_COUNT ?? 0) || 0;
  reglages.forEach(([cle, valeur], rang) => {
    suite[`GIT_CONFIG_KEY_${depart + rang}`] = cle;
    suite[`GIT_CONFIG_VALUE_${depart + rang}`] = valeur;
  });
  suite.GIT_CONFIG_COUNT = String(depart + reglages.length);
  return suite;
}

/**
 * Environnement de git pour un dépôt d'aperçu : dossier git et arbre de travail désignés, hooks et
 * moniteur coupés. Sans effet (env inchangé) si le dépôt n'a pas de dossier git rangé à côté.
 */
export function environnementGitIsole(env: NodeJS.ProcessEnv, depot: string): NodeJS.ProcessEnv {
  const dossierGit = dossierGitDe(depot);
  if (!dossierGit || !existsSync(dossierGit)) return env;
  return avecReglages({ ...env, GIT_DIR: dossierGit, GIT_WORK_TREE: depot }, REGLAGES_IMPOSES);
}

/**
 * Dépôt cloné avant ce changement : son `.git` est dans le dossier monté. On le range à côté, on
 * retire ses hooks (ils ont pu être posés depuis le conteneur), et `.git` devient un simple fichier
 * de renvoi. Sans effet pour un dépôt déjà rangé ou absent.
 */
export async function isolerGit(depot: string): Promise<void> {
  const dossierGit = dossierGitDe(depot);
  const dansDepot = join(depot, '.git');
  if (!dossierGit || !existsSync(dansDepot) || !statSync(dansDepot).isDirectory()) return;
  if (existsSync(dossierGit)) await rm(dossierGit, { recursive: true, force: true });
  await rename(dansDepot, dossierGit);
  await rm(join(dossierGit, 'hooks'), { recursive: true, force: true });
  await writeFile(dansDepot, `gitdir: ${dossierGit}\n`);
}

/** Variables du serveur qui n'ont rien à faire dans l'environnement de l'agent (il y lance des commandes). */
const SECRETS_DU_SERVEUR = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'SESSION_SECRET', 'OBSERVE_APP_KEY', 'OBSERVE_APP_SECRET'];

/** Environnement de l'agent : celui du serveur sans ses secrets, et git verrouillé sur le dépôt de travail. */
export function environnementAgent(env: NodeJS.ProcessEnv, depot: string): NodeJS.ProcessEnv {
  const propre = { ...env };
  for (const nom of SECRETS_DU_SERVEUR) delete propre[nom];
  return environnementGitIsole(propre, depot);
}
