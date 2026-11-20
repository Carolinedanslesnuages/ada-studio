/** Indicateurs d'ADA : fonctions pures, calculées à partir de ce que GitHub sait des demandes. */
import type { BilanProjets } from './registre.js';

/** Une demande (story, problème ou mode libre), telle que GitHub permet de la mesurer. */
export interface DemandeMesuree {
  livree: boolean;
  /** Fermeture de l'issue (livraison). */
  fermeeLe: string | null;
  /** Premier passage au statut « en cours » (lancement depuis ADA), s'il est connu. */
  lanceeLe: string | null;
}

export interface Mesures {
  storiesLivrees: number;
  /** Temps moyen du lancement à la livraison, en minutes ; null sans mesure possible. */
  dureeMoyenneMinutes: number | null;
}

export interface IndicateursProjet extends Mesures {
  nom: string;
}

export interface Indicateurs extends Mesures {
  projets: number;
  /** Tous les projets passés par ADA, y compris archivés, retirés ou supprimés depuis. */
  historique: BilanProjets;
  parProjet: IndicateursProjet[];
}

const minutesEntre = (debut: string, fin: string) => (Date.parse(fin) - Date.parse(debut)) / 60000;

function mesurer(demandes: DemandeMesuree[]): Mesures {
  const livrees = demandes.filter((demande) => demande.livree);
  const durees = livrees
    .filter((demande) => demande.lanceeLe && demande.fermeeLe)
    .map((demande) => minutesEntre(demande.lanceeLe!, demande.fermeeLe!))
    .filter((duree) => Number.isFinite(duree) && duree >= 0);
  return {
    storiesLivrees: livrees.length,
    dureeMoyenneMinutes: durees.length ? Math.round(durees.reduce((somme, duree) => somme + duree, 0) / durees.length) : null,
  };
}

export function calculerIndicateurs(projets: { nom: string; demandes: DemandeMesuree[] }[], historique: BilanProjets): Indicateurs {
  return {
    projets: projets.length,
    historique,
    ...mesurer(projets.flatMap((projet) => projet.demandes)),
    parProjet: projets
      .map((projet) => ({ nom: projet.nom, ...mesurer(projet.demandes) }))
      .sort((premier, second) => second.storiesLivrees - premier.storiesLivrees || premier.nom.localeCompare(second.nom)),
  };
}

/** Lancement de la demande depuis ADA, d'après les événements de label de l'issue. */
export function lireHistorique(
  evenements: { event?: string; created_at?: string; label?: { name?: string } | null }[],
  labelEnCours: string,
): { lanceeLe: string | null } {
  const poses = evenements.filter((evenement) => evenement.event === 'labeled');
  const lancement = poses
    .filter((evenement) => evenement.label?.name === labelEnCours && evenement.created_at)
    .map((evenement) => evenement.created_at!)
    .sort()[0];
  return { lanceeLe: lancement ?? null };
}
