/**
 * Script d'arrière-plan (service worker sous Chrome et Edge, script d'arrière-plan sous Firefox).
 * Il ne garde rien en mémoire entre deux réveils : tout état passe par chrome.storage.
 */
// Arrière-plan : n'importer que des modules sans dépendance (pas de Vue ni de Pinia ici).
import { REGLAGES_PAR_DEFAUT } from './reglages'

export async function initialiser(): Promise<void> {
  const existants = await chrome.storage.local.get('reglages')
  if (!('reglages' in existants)) await chrome.storage.local.set({ reglages: REGLAGES_PAR_DEFAUT })
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    void initialiser()
  })
}
