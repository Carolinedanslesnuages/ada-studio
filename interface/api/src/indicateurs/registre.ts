/** Registre des projets d'ADA : règles pures (le fichier est géré par RegistreService). */

export type Origine = 'cree' | 'repris' | 'inconnue';
export type EtatProjet = 'actif' | 'archive' | 'retire' | 'supprime';

export interface EntreeRegistre {
  /** Identifiant ADA du projet (« nom » ou « compte~nom »). */
  id: string;
  owner: string;
  repo: string;
  origine: Origine;
  /** Date d'entrée dans ADA (création, reprise, ou première trace connue). */
  le: string;
  par: string | null;
}

export interface BilanProjets {
  total: number;
  crees: number;
  repris: number;
  actifs: number;
  archives: number;
  /** Encore sur GitHub mais plus dans ADA (reprise annulée, désynchronisé). */
  retires: number;
  /** Disparus de GitHub. */
  supprimes: number;
}

/** Ajoute une entrée si le projet n'y est pas encore (le registre ne fait que grandir). */
export function enregistrer(registre: EntreeRegistre[], entree: EntreeRegistre): EntreeRegistre[] {
  const existante = registre.find((ligne) => ligne.id === entree.id);
  if (!existante) return [...registre, entree];
  // Une trace « inconnue » (aperçu) est précisée dès qu'on connaît l'origine.
  if (existante.origine === 'inconnue' && entree.origine !== 'inconnue') {
    return registre.map((ligne) => (ligne.id === entree.id ? { ...ligne, origine: entree.origine, par: entree.par ?? ligne.par } : ligne));
  }
  return registre;
}

/**
 * État d'un projet du registre, d'après GitHub : null = introuvable (supprimé, ou plus accessible).
 */
export function etatProjet(depot: { archived?: boolean; topics?: string[] } | null, topicAtelier: string): EtatProjet {
  if (!depot) return 'supprime';
  if (depot.archived) return 'archive';
  return (depot.topics ?? []).includes(topicAtelier) ? 'actif' : 'retire';
}

export function bilan(projets: { origine: Origine; etat: EtatProjet }[]): BilanProjets {
  const compter = (critere: (projet: { origine: Origine; etat: EtatProjet }) => boolean) => projets.filter(critere).length;
  return {
    total: projets.length,
    crees: compter((projet) => projet.origine !== 'repris'),
    repris: compter((projet) => projet.origine === 'repris'),
    actifs: compter((projet) => projet.etat === 'actif'),
    archives: compter((projet) => projet.etat === 'archive'),
    retires: compter((projet) => projet.etat === 'retire'),
    supprimes: compter((projet) => projet.etat === 'supprime'),
  };
}
