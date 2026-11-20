/** Phase de réalisation : le plan validé est réalisé sur une branche, puis la branche est poussée et la PR ouverte. */
import { brancheDe, type Tache } from './agent.js';
import { consigneRealisation } from './consignes.js';
import type { OutilsPhase } from './outils-phase.js';
import { lireResultat } from './reponses.js';

const REPRISE =
  '\n\nReprise : une exécution précédente a été interrompue. Les fichiers modifiés ou non suivis de la branche (git status) sont ce travail en cours : vérifie-les et continue, sans repartir de zéro.';

export async function phaseRealisation(outils: OutilsPhase, { jeton, login, depot, numero }: Tache): Promise<void> {
  const demande = await outils.demande(jeton, depot, numero);
  const branche = brancheDe(demande);
  const { cwd, travailRepris } = await outils.preparerBranche(jeton, login, depot, branche);
  const skills = await outils.equiperSkills(cwd);
  await outils.noter(depot, numero, travailRepris ? `Reprend le travail interrompu sur ${branche}` : `Travaille sur la branche ${branche}`);
  const { controles, style, composants } = await outils.apercu.lireConfig(cwd);
  const consigne = consigneRealisation(demande, branche, await outils.lireIndexRgaa(), skills.noms, controles, { style, composants }) + (travailRepris ? REPRISE : '');
  const reponse = await outils.executer(depot, numero, 'realisation', consigne, cwd, skills.dossiers);
  const resultat = lireResultat(reponse);
  if (!resultat || resultat.resultat === 'bloque') {
    await outils.bloquer(jeton, depot, numero, resultat?.resultat === 'bloque' ? resultat.raison : 'ADA n’a pas terminé la réalisation.');
    return;
  }
  if ((await outils.compterCommits(cwd, `origin/main..${branche}`)) === 0) {
    await outils.bloquer(jeton, depot, numero, 'ADA n’a enregistré aucune modification.');
    return;
  }
  if (await outils.toucheDossiersReserves(jeton, depot, numero, cwd, branche)) return;
  await outils.pousser(jeton, depot, numero, cwd, branche);
  const pr = await outils.ouvrirPullRequest(jeton, depot, cwd, branche, demande, resultat.resume);
  await outils.enregistrer(depot, numero, { pullRequest: pr });
  await outils.stories.commenterAssistant(jeton, depot, numero, 'Réalisation terminée', `${resultat.resume}\n\nLes contrôles automatiques tournent sur la pull request : ${pr}`);
  await outils.relancerApercu(depot, numero);
  await outils.stories.changerStatut(jeton, depot, numero, 'en-verification');
  await outils.noter(depot, numero, 'Terminé : à vous de vérifier');
}
