/**
 * Phase de conversation (« vrai prompt ») : ADA répond au dernier message du PO en agissant tout
 * de suite sur sa branche ; à « c'est bon », contrôles complets puis PR.
 */
import { randomUUID } from 'node:crypto';
import { texteDecoupage } from '../stories/story.js';
import { brancheDe, type Demande, type Tache } from './agent.js';
import { consigneConversation, consigneSuiteConversation } from './consignes.js';
import type { OutilsPhase } from './outils-phase.js';
import { lireFinConversation, type FinConversation } from './reponses.js';

export async function phaseConversation(outils: OutilsPhase, { jeton, login, depot, numero, finaliser = false }: Tache): Promise<void> {
  const demande = await outils.demande(jeton, depot, numero);
  const branche = brancheDe(demande);
  const { cwd } = await outils.preparerBranche(jeton, login, depot, branche);
  const skills = await outils.equiperSkills(cwd);
  await outils.noter(depot, numero, finaliser ? 'Lance les contrôles complets avant de proposer vos changements' : `Lit votre message (branche ${branche})`);
  const { controles, style, composants } = await outils.apercu.lireConfig(cwd);
  const indexRgaa = await outils.lireIndexRgaa();
  const executerConversation = async (consigne: string, session: { id: string; reprendre: boolean }) =>
    lireFinConversation(await outils.executer(depot, numero, 'conversation', consigne, cwd, skills.dossiers, session));

  // Garder le fil : la session de l'agent est reprise d'un message à l'autre (il a déjà les règles
  // et l'historique) ; sans session, ou si elle ne se reprend plus, on repart de la consigne complète.
  const precedente = (await outils.lireActivite(depot, numero)).session ?? null;
  const dernierMessage = [...demande.echanges].reverse().find((echange) => echange.auteur === 'po')?.texte;
  let fin: FinConversation | null = null;
  if (precedente && dernierMessage) {
    fin = await executerConversation(consigneSuiteConversation(dernierMessage, controles, finaliser), { id: precedente, reprendre: true }).catch((e: unknown) => {
      outils.log.warn(`Reprise de la session de ${depot}#${numero} impossible : ${(e as Error).message}`);
      return null;
    });
  }
  if (!fin) {
    const session = randomUUID();
    await outils.enregistrer(depot, numero, { session });
    fin = await executerConversation(consigneConversation(demande, branche, indexRgaa, skills.noms, controles, { style, composants }, finaliser), { id: session, reprendre: false });
  }
  if (!fin) {
    await outils.bloquer(jeton, depot, numero, 'ADA n’a pas réussi à répondre à votre message.');
    return;
  }
  // Des commits pas encore sur GitHub : on pousse la branche (jamais main) et l'aperçu les montre.
  if ((await outils.compterCommits(cwd, branche, '--not', '--remotes=origin')) > 0) {
    if (await outils.toucheDossiersReserves(jeton, depot, numero, cwd, branche)) return;
    await outils.pousser(jeton, depot, numero, cwd, branche);
    await outils.relancerApercu(depot, numero);
  }
  if (!finaliser) {
    // Stories pour plus tard : jointes au message, le PO les choisit et ADA les publie (même circuit qu'un découpage).
    const message = fin.stories.length ? texteDecoupage(fin.reponse, fin.stories) : fin.reponse;
    await outils.stories.commenterAssistant(jeton, depot, numero, 'ADA', message);
    await outils.stories.changerStatut(jeton, depot, numero, 'echange');
    await outils.noter(depot, numero, 'À vous : répondez à ADA');
    return;
  }
  await proposerChangements(outils, { jeton, login, depot, numero }, cwd, branche, demande, fin);
}

/**
 * Fin de conversation (« c'est bon ») : contrôles complets passés → PR (circuit habituel :
 * vérification et fusion par le PO) ; aucun changement → conversation close ; contrôle en échec →
 * ADA le dit et la conversation reste ouverte.
 */
async function proposerChangements(
  outils: OutilsPhase,
  { jeton, login, depot, numero }: Pick<Tache, 'jeton' | 'login' | 'depot' | 'numero'>,
  cwd: string,
  branche: string,
  demande: Demande,
  fin: FinConversation,
): Promise<void> {
  const { stories } = outils;
  if (!fin.pret) {
    await stories.commenterAssistant(jeton, depot, numero, 'Pas encore prêt', `${fin.reponse}\n\nDites-moi comment continuer, ou demandez l’aide d’un développeur.`);
    await stories.changerStatut(jeton, depot, numero, 'echange');
    await outils.noter(depot, numero, 'Un contrôle ne passe pas : à vous');
    return;
  }
  if ((await outils.compterCommits(cwd, `origin/main..${branche}`)) === 0) {
    await stories.fermerSansSuite(jeton, depot, numero, `💬 Conversation terminée par ${login}, sans changement à proposer au projet.`);
    return;
  }
  const pr = await outils.ouvrirPullRequest(jeton, depot, cwd, branche, demande, fin.reponse);
  await outils.enregistrer(depot, numero, { pullRequest: pr });
  await stories.commenterAssistant(jeton, depot, numero, 'Changements proposés au projet', `${fin.reponse}\n\nLes contrôles automatiques tournent sur la pull request : ${pr}`);
  await stories.changerStatut(jeton, depot, numero, 'en-verification');
  await outils.noter(depot, numero, 'Terminé : à vous de vérifier');
}
