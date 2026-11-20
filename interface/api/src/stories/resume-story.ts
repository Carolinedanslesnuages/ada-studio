/** Ce qu'ADA montre d'une demande (résumé, détail) et comment elle la lit dans une issue GitHub. */
import { raisonAuteurInconnu } from './confiance.js';
import type { DemandeFigee } from './demandes.js';
import { lireBug, lireConversation, lireParent, lirePrompt, lireStory, typeDepuis, verifierPrete, type ContenuBug, type ContenuStory, type Statut, type TypeDemande } from './story.js';

export interface ResumeStory {
  numero: number;
  type: TypeDemande;
  titre: string;
  statut: Statut;
  creeeLe: string;
  /** Date de fermeture de l'issue (livraison), null tant qu'elle est ouverte. */
  fermeeLe: string | null;
  url: string;
  /** Prête à être lancée (complète, assez petite) ; sinon la raison, à corriger sur GitHub. */
  prete: boolean;
  raison: string | null;
  /** Demande découpée dont la story est issue (ordre du découpage) ; null sinon. */
  parent: number | null;
  /** Écrite par quelqu'un qui a le droit d'écrire dans le projet (voir confiance.ts). */
  fiable: boolean;
}

export interface Message {
  id: number;
  auteur: string;
  avatar: string | null;
  texte: string;
  le: string;
}

/** Développeur qui peut être assigné à une demande (accès au dépôt du projet). */
export interface Personne {
  login: string;
  avatar: string | null;
}

export interface DetailStory extends ResumeStory {
  /** Développeurs assignés sur GitHub (déblocage d'une demande « Besoin d'un développeur »). */
  assignes: Personne[];
  contenu: ContenuStory | null;
  contenuBug: ContenuBug | null;
  /** Mode sauvage : le prompt du PO. */
  contenuLibre: string | null;
  texteBrut: string;
  messages: Message[];
  /** Empreinte du titre et du corps affichés : renvoyée au lancement pour vérifier que rien n'a changé. */
  empreinte: string;
  /** Commentaires écrits directement sur GitHub depuis le lancement, qu'ADA ne lit pas (le PO doit répondre dans ADA). */
  commentairesIgnores: number;
}
export type Issue = {
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at?: string | null;
  /** « not_planned » : fermée sans être réalisée (doublon, abandon) — ce n'est pas une livraison. */
  state_reason?: string | null;
  html_url: string;
  body?: string | null;
  pull_request?: unknown;
  labels: (string | { name?: string })[];
  /** Lien de l'auteur avec le dépôt (OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, NONE…). */
  author_association?: string | null;
  user?: { login?: string | null } | null;
};

export const nomsLabels = (labels: Issue['labels']) => labels.map((l) => (typeof l === 'string' ? l : (l.name ?? '')));

/** `deConfiance` : l'auteur a le droit d'écrire dans le projet (voir confiance.ts) ; sinon la demande ne se lance pas. */
export const resumer = (i: Issue, deConfiance: boolean, statut: Statut): ResumeStory => {
  const labels = nomsLabels(i.labels);
  const corps = i.body ?? '';
  const type = typeDepuis(labels, corps) ?? 'story';
  const verification = verifierPrete(type, lireStory(corps), lireBug(corps), lirePrompt(corps) ?? lireConversation(corps));
  return {
    numero: i.number,
    type,
    titre: i.title,
    statut,
    creeeLe: i.created_at,
    fermeeLe: i.closed_at ?? null,
    url: i.html_url,
    prete: verification.prete && deConfiance,
    raison: !deConfiance ? raisonAuteurInconnu(i.user?.login) : verification.prete ? null : verification.raison,
    parent: lireParent(corps),
    fiable: deConfiance,
  };
};

/** La demande telle qu'elle est dans l'issue, figée au lancement : l'agent ne lira jamais l'issue vivante. */
export function figeeDepuisIssue(issue: Issue, type: TypeDemande, login: string): DemandeFigee {
  const corps = issue.body ?? '';
  return {
    numero: issue.number,
    titre: issue.title,
    type,
    contenu: lireStory(corps),
    contenuBug: lireBug(corps),
    contenuLibre: lirePrompt(corps) ?? lireConversation(corps),
    parent: lireParent(corps),
    lanceeLe: new Date().toISOString(),
    lanceePar: login,
  };
}
