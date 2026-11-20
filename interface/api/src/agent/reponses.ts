/** Lecture des réponses de l'agent (son JSON final), à transmettre au PO ou à GitHub. */
import { nettoyerStoriesProposees, type StoryProposee } from '../stories/story.js';
import { MARQUEUR_CHOIX, type DecisionAnalyse, type QuestionAChoix, type ResultatRealisation } from './agent.js';

/**
 * Réponse d'ADA en conversation : son message, si les contrôles complets passent (par défaut, oui),
 * et les stories qu'elle propose d'écrire (le PO les choisit, ADA les publie à son nom).
 */
export interface FinConversation {
  reponse: string;
  pret: boolean;
  stories: StoryProposee[];
}

/** Fin de conversation : la réponse, et si les contrôles complets passent (par défaut, oui). */
export function lireFinConversation(texte: string): FinConversation | null {
  const reponse = lireReponseConversation(texte);
  if (!reponse) return null;
  const json = lireJson<{ pret?: unknown; stories?: unknown }>(texte, (valeur) => 'reponse' in valeur);
  return { reponse, pret: json?.pret !== false, stories: nettoyerStoriesProposees(json?.stories, 1) };
}

/** Réponse d'ADA en conversation : son JSON, ou à défaut son texte brut (mieux qu'un blocage). */
export function lireReponseConversation(texte: string): string | null {
  const json = lireJson<{ reponse?: unknown }>(texte, (valeur) => 'reponse' in valeur);
  if (json && typeof json.reponse === 'string' && json.reponse.trim()) return json.reponse.trim();
  const brut = texte.replace(/```(?:json)?/g, '').trim();
  return brut && !brut.startsWith('{') ? brut : null;
}

/** Extrait le dernier objet JSON d'une réponse (l'agent l'entoure parfois de ```json). */
export function lireJson<T>(texte: string, accepter: (valeur: Record<string, unknown>) => boolean = () => true): T | null {
  const nettoye = texte.replace(/```(?:json)?/g, '');
  // De la fin vers le début : le JSON final de l'agent, même s'il contient des objets imbriqués
  // (ses choix) ou si du texte le précède.
  for (let debut = nettoye.lastIndexOf('{"'); debut >= 0; debut = nettoye.lastIndexOf('{"', debut - 1)) {
    for (let fin = nettoye.lastIndexOf('}'); fin > debut; fin = nettoye.lastIndexOf('}', fin - 1)) {
      try {
        const valeur = JSON.parse(nettoye.slice(debut, fin + 1)) as unknown;
        if (valeur && typeof valeur === 'object' && !Array.isArray(valeur) && accepter(valeur as Record<string, unknown>)) return valeur as T;
      } catch {
        // pas un JSON complet : on essaie une fin plus courte
      }
    }
    if (debut === 0) break;
  }
  return null;
}

export function lireDecision(texte: string): DecisionAnalyse | null {
  const r = lireJson<DecisionAnalyse>(texte, (valeur) => 'decision' in valeur);
  if (!(r && ['questions', 'plan', 'decoupage', 'attente'].includes(r.decision) && typeof r.texte === 'string' && r.texte.trim())) return null;
  if (r.decision === 'decoupage') {
    const stories = nettoyerStoriesProposees(r.stories);
    // Découpage inexploitable : on garde l'explication, comme des questions (comportement d'avant).
    return stories.length ? { decision: 'decoupage', texte: r.texte, stories } : { decision: 'questions', texte: r.texte };
  }
  const choix = r.decision === 'questions' ? nettoyerChoix(r.choix) : [];
  return { decision: r.decision, texte: r.texte, ...(choix.length ? { choix } : {}) };
}

/** Ne garde que des questions à choix bien formées (au plus 3, 2 à 6 options courtes, sans doublon). */
export function nettoyerChoix(brut: unknown): QuestionAChoix[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .map((element) => element as Partial<QuestionAChoix>)
    .filter((element) => typeof element?.question === 'string' && element.question.trim() && Array.isArray(element.choix))
    .map((element) => ({
      // ADA numérote elle-même les questions : on retire le numéro que l'assistant a pu ajouter (« 1. »).
      question: element.question!.trim().replace(/^\d+\s*[.)]\s*/, '').slice(0, 300),
      choix: [...new Set((element.choix as unknown[]).filter((option): option is string => typeof option === 'string' && option.trim() !== '').map((option) => option.trim().slice(0, 200)))].slice(0, 6),
      plusieurs: element.plusieurs === true,
    }))
    .filter((element) => element.choix.length >= 2)
    .slice(0, 3);
}

/**
 * Texte du commentaire de questions : lisible sur GitHub (options en cases « - [ ] ») et, en fin,
 * les choix structurés pour l'écran d'ADA, dans un commentaire HTML (encodés : aucun « -- »).
 */
export function texteQuestions(decision: DecisionAnalyse): string {
  if (!decision.choix?.length) return decision.texte;
  const lisible = decision.choix
    .map(
      (question, rang) =>
        `${rang + 1}. ${question.question} (${question.plusieurs ? 'plusieurs réponses possibles' : 'une seule réponse'})\n` +
        question.choix.map((option) => `   - [ ] ${option}`).join('\n'),
    )
    .join('\n');
  const donnees = Buffer.from(JSON.stringify(decision.choix), 'utf8').toString('base64');
  return `${decision.texte}\n\n**Choix proposés** (à cocher dans ADA) :\n${lisible}\n\n<!-- ${MARQUEUR_CHOIX} ${donnees} -->`;
}

export function lireResultat(texte: string): ResultatRealisation | null {
  const r = lireJson<ResultatRealisation>(texte, (valeur) => 'resultat' in valeur);
  if (r?.resultat === 'ok' && typeof r.resume === 'string') return r;
  if (r?.resultat === 'bloque' && typeof r.raison === 'string') return r;
  return null;
}
