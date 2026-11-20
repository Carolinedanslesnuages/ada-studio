/**
 * Stockage de l'extension : `chrome.storage.local` dans le navigateur, `localStorage` en dehors
 * (aperçu d'ADA, tests). Jamais de donnée personnelle ni de secret ici.
 */
const PREFIXE = 'extension:'

const stockageNavigateur = (): chrome.storage.StorageArea | null =>
  typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null

export async function lire<T>(cle: string, valeurParDefaut: T): Promise<T> {
  const zone = stockageNavigateur()
  if (zone) {
    const resultat = await zone.get(cle)
    return cle in resultat ? (resultat[cle] as T) : valeurParDefaut
  }
  const brut = window.localStorage.getItem(PREFIXE + cle)
  return brut === null ? valeurParDefaut : (JSON.parse(brut) as T)
}

export async function ecrire<T>(cle: string, valeur: T): Promise<void> {
  const zone = stockageNavigateur()
  if (zone) {
    await zone.set({ [cle]: valeur })
    return
  }
  window.localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur))
}
