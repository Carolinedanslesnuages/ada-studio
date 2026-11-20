import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { REGLAGES_PAR_DEFAUT, type Reglages } from '@/reglages'
import { ecrire, lire } from '@/services/stockage'

/** Réglages de l'extension, partagés par la fenêtre de l'extension et ses futurs écrans. */

export const useReglagesStore = defineStore('reglages', () => {
  const reglages = ref<Reglages>({ ...REGLAGES_PAR_DEFAUT })
  const charge = ref(false)

  async function charger(): Promise<void> {
    reglages.value = { ...REGLAGES_PAR_DEFAUT, ...(await lire<Partial<Reglages>>('reglages', {})) }
    charge.value = true
  }

  async function changerActivation(active: boolean): Promise<void> {
    reglages.value = { ...reglages.value, active }
    await ecrire('reglages', reglages.value)
  }

  return { reglages, charge, charger, changerActivation }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useReglagesStore, import.meta.hot))
