/** Règles du composant (fonctions pures, testées) : lecture des attributs et recherche. */

/** Liste passée en attribut : JSON (["a","b"]) ou texte séparé par des « ; ». */
export function lireElements(attribut: string | null | undefined): string[] {
  if (!attribut) return []
  try {
    const valeur: unknown = JSON.parse(attribut)
    if (Array.isArray(valeur)) return valeur.map(String).map((texte) => texte.trim()).filter(Boolean)
  } catch {
    // pas du JSON : liste séparée par des points-virgules
  }
  return attribut.split(';').map((texte) => texte.trim()).filter(Boolean)
}

/** Sans accents ni majuscules, pour que « eleve » trouve « Élève ». */
const normaliser = (texte: string) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function rechercher(elements: string[], recherche: string): string[] {
  const cherche = normaliser(recherche)
  return cherche ? elements.filter((element) => normaliser(element).includes(cherche)) : elements
}

export const annonceResultats = (nombre: number) =>
  nombre === 0 ? 'Aucun résultat' : `${nombre} résultat${nombre > 1 ? 's' : ''}`
