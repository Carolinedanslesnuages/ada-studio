import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { lireFormulaire, type Formulaire } from '@/services/formulaire'

/** La définition du formulaire : lue par l'écran de saisie et par la page « Réponses ». */
export const useFormulaireStore = defineStore('formulaire', () => {
  const formulaire = ref<Formulaire | null>(null)
  const erreur = ref<string | null>(null)

  async function charger(): Promise<void> {
    if (formulaire.value) return
    try {
      formulaire.value = await lireFormulaire()
      erreur.value = null
    } catch {
      erreur.value = 'Le formulaire n’a pas pu être chargé. Réessayez dans quelques instants.'
    }
  }

  return { formulaire, erreur, charger }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useFormulaireStore, import.meta.hot))
