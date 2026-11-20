/**
 * Qui peut parler au nom du PO ? Les issues et leurs commentaires sont publics sur un dépôt public,
 * et ADA en reconstitue les échanges de l'agent (« [PO] … ») et l'écran du PO. Un commentaire ou
 * une issue écrits par un compte sans droit d'écriture sur le projet ne doivent donc jamais être
 * pris pour une consigne : l'agent y lit des ordres, et le PO y lit des plans qu'il croirait d'ADA.
 *
 * GitHub indique le lien de l'auteur avec le dépôt (`author_association`), mais ce lien ne dit pas
 * le droit : un « membre » d'organisation ou un « collaborateur » peut n'avoir qu'un droit de
 * lecture. Seul le propriétaire est donc cru sur parole ; pour les autres, ADA demande à GitHub
 * le niveau de droit réel (`DROITS_D_ECRITURE`). ADA écrit toujours au nom du PO (jeton
 * utilisateur) : ses messages portent le lien du PO lui-même.
 */
export type Lien = 'cru' | 'a-verifier' | 'refuse';

/** Propriétaire : cru. Membre ou collaborateur : à vérifier. Tout le reste (ou rien) : refusé. */
export function lienDeConfiance(lien: string | null | undefined): Lien {
  if (lien === 'OWNER') return 'cru';
  if (lien === 'MEMBER' || lien === 'COLLABORATOR') return 'a-verifier';
  return 'refuse';
}

/** Niveaux de droit qui permettent d'écrire dans le projet (`triage` et `read` ne le permettent pas). */
const DROITS_D_ECRITURE = new Set(['admin', 'maintain', 'write']);

export const droitEcriture = (niveau: string | null | undefined): boolean => DROITS_D_ECRITURE.has(String(niveau));

/** Pourquoi une demande écrite par ce compte ne peut pas être lancée (dit au PO, en clair). */
export const raisonAuteurInconnu = (login: string | null | undefined): string =>
  `elle a été écrite par ${login ?? 'un compte inconnu'}, qui n’a pas le droit d’écrire dans le projet : recopiez-la dans une nouvelle demande de votre compte`;
