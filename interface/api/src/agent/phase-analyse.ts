/** Phase d'analyse : questions, plan, découpage ou attente, publiés dans l'issue ; aucune modification du code. */
import { texteDecoupage } from '../stories/story.js';
import type { Tache } from './agent.js';
import { consigneAnalyse } from './consignes.js';
import type { OutilsPhase } from './outils-phase.js';
import { lireDecision, texteQuestions } from './reponses.js';

export async function phaseAnalyse(outils: OutilsPhase, { jeton, depot, numero }: Tache): Promise<void> {
  const { stories } = outils;
  await outils.noter(depot, numero, 'Prépare le projet');
  const cwd = await outils.apercu.preparerDepot(jeton, depot);
  const skills = await outils.equiperSkills(cwd);
  await outils.noter(depot, numero, 'Lit la story et le projet');
  const { style, composants } = await outils.apercu.lireConfig(cwd);
  const demande = { ...(await outils.demande(jeton, depot, numero)), existantes: await outils.existantes(jeton, depot, numero) };
  const consigne = consigneAnalyse(demande, await outils.lireIndexRgaa(), skills.noms, { style, composants });
  const reponse = await outils.executer(depot, numero, 'analyse', consigne, cwd, skills.dossiers);
  const decision = lireDecision(reponse);
  if (!decision) {
    await outils.bloquer(jeton, depot, numero, 'ADA n’a pas réussi à analyser la demande.');
    return;
  }
  if (decision.decision === 'decoupage') {
    await stories.commenterAssistant(jeton, depot, numero, 'Découpage proposé', texteDecoupage(decision.texte, decision.stories ?? []));
    await stories.changerStatut(jeton, depot, numero, 'decoupage');
    await outils.noter(depot, numero, 'Attend que vous choisissiez les stories à créer');
    return;
  }
  if (decision.decision === 'attente') {
    await stories.commenterAssistant(jeton, depot, numero, 'Demande mise en attente', decision.texte);
    await stories.changerStatut(jeton, depot, numero, 'attente');
    await outils.noter(depot, numero, 'En attente : à relancer quand ce qu’elle attend sera livré');
    return;
  }
  const questions = decision.decision === 'questions';
  await stories.commenterAssistant(jeton, depot, numero, questions ? 'Questions d’ADA' : 'Plan proposé', texteQuestions(decision));
  await stories.changerStatut(jeton, depot, numero, questions ? 'questions' : 'plan-a-valider');
  await outils.noter(depot, numero, questions ? 'Attend vos réponses' : 'Attend que vous validiez le plan');
}
