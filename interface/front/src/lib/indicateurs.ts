/** Indicateurs d'ADA (api/src/indicateurs/indicateurs.ts) et leur mise en forme. */
export interface Mesures {
  storiesLivrees: number
  dureeMoyenneMinutes: number | null
}

/** Tous les projets passés par ADA, y compris archivés, retirés ou supprimés depuis. */
export interface BilanProjets {
  total: number
  crees: number
  repris: number
  actifs: number
  archives: number
  retires: number
  supprimes: number
}

export interface Indicateurs extends Mesures {
  projets: number
  historique: BilanProjets
  parProjet: (Mesures & { nom: string })[]
}

const SANS_MESURE = 'Pas encore mesurable'

/** « 25 min », « 1 h 05 », « 2 j 3 h ». */
export function duree(minutes: number | null): string {
  if (minutes === null) return SANS_MESURE
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `${heures} h ${String(Math.round(minutes % 60)).padStart(2, '0')}`
  return `${Math.floor(heures / 24)} j ${heures % 24} h`
}
