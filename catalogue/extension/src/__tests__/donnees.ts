import { vi } from 'vitest'

/** Faux chrome.storage.local (en mémoire) pour les tests. */
export function simulerChromeStorage(initial: Record<string, unknown> = {}) {
  const memoire: Record<string, unknown> = { ...initial }
  const local = {
    get: vi.fn<(cle: string) => Promise<Record<string, unknown>>>(async (cle) => (cle in memoire ? { [cle]: memoire[cle] } : {})),
    set: vi.fn<(valeurs: Record<string, unknown>) => Promise<void>>(async (valeurs) => {
      Object.assign(memoire, valeurs)
    }),
  }
  vi.stubGlobal('chrome', { storage: { local }, runtime: {} })
  return { memoire, local }
}

/**
 * localStorage en mémoire : celui de jsdom est masqué par celui, expérimental, de Node 25 et plus
 * (indéfini sans --localstorage-file).
 */
export function simulerLocalStorage() {
  const memoire = new Map<string, string>()
  const stockage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
    clear: () => memoire.clear(),
    key: (rang: number) => [...memoire.keys()][rang] ?? null,
    get length() {
      return memoire.size
    },
  }
  vi.stubGlobal('localStorage', stockage)
  return stockage
}
