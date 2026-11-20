/**
 * Ce que l'agent de code reçoit et rend : la demande, ses décisions, le nom de sa branche.
 * Consignes : consignes.ts ; outils permis : outils.ts ; lecture des réponses : reponses.ts ;
 * activité traduite pour le PO : activite.ts.
 */
import type { ContenuBug, ContenuStory, StoryProposee, TypeDemande } from '../stories/story.js';

/** « reprise » : analyse d'un projet existant repris par ADA (#37), en lecture seule. */
export type Phase = 'analyse' | 'realisation' | 'reprise' | 'conversation';

export interface Demande {
  numero: number;
  titre: string;
  type: TypeDemande;
  contenu: ContenuStory | null;
  contenuBug: ContenuBug | null;
  /** Mode sauvage : le prompt du PO. */
  contenuLibre: string | null;
  /** Échanges depuis le lancement (questions, plan, réponses du PO), dans l'ordre. */
  echanges: { auteur: 'assistant' | 'po'; texte: string }[];
  /** Analyse : les autres stories du projet, pour ne jamais en proposer une deuxième fois. */
  existantes?: StoryExistante[];
  /** Demande découpée dont celle-ci est issue : elle se termine quand ses stories sont livrées. */
  parent?: number | null;
}

/** Ce qu'il faut faire, décrit par des données : peut être confié à un processus travailleur. */
export interface Tache {
  phase: Phase;
  jeton: string;
  login: string;
  depot: string;
  numero: number;
  /** Phase « reprise » : stack indiquée par le PO (facultative) et apparence choisie. */
  reprise?: { modele: string | null };
  /** Conversation : le PO a dit « c'est bon » (contrôles complets, puis PR). */
  finaliser?: boolean;
}

/** Une story ou un problème déjà écrit dans le projet (ouvert, ou livré). */
export interface StoryExistante {
  numero: number;
  titre: string;
  livree: boolean;
  /** Demande découpée dont elle est issue, s'il y en a une. */
  parent?: number | null;
  /** Vrai : demande découpée, qui ne livre rien elle-même (elle attend ses stories). */
  decoupee?: boolean;
}

/** Une question qui se tranche entre quelques options : le PO répond en cochant (#35). */
export interface QuestionAChoix {
  question: string;
  choix: string[];
  /** Vrai : plusieurs réponses possibles (cases à cocher) ; faux : une seule (boutons radio). */
  plusieurs: boolean;
}

export type DecisionAnalyse = {
  decision: 'questions' | 'plan' | 'decoupage' | 'attente';
  texte: string;
  choix?: QuestionAChoix[];
  /** Découpage : les stories proposées (le PO choisit lesquelles ADA crée, #36). */
  stories?: StoryProposee[];
};

/** Marque, dans le commentaire GitHub, les choix structurés lus par ADA (invisibles sur GitHub). */
export const MARQUEUR_CHOIX = 'ada:choix';
export type ResultatRealisation = { resultat: 'ok'; resume: string } | { resultat: 'bloque'; raison: string };

export function brancheDe(demande: Pick<Demande, 'numero' | 'titre' | 'type'>): string {
  const slug = demande.titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  const prefixe = { bug: 'fix', libre: 'libre', story: 'story', conversation: 'conversation' }[demande.type];
  return `${prefixe}/${demande.numero}-${slug.replace(/^(demande-libre|conversation)-/, '') || 'demande'}`;
}
