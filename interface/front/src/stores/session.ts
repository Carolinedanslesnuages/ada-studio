import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, ErreurApi } from '@/services/api'

export interface Utilisateur {
  login: string
  nom: string | null
  avatar: string
}

export const useSessionStore = defineStore('session', () => {
  const utilisateur = ref<Utilisateur | null>(null)
  const verifiee = ref(false)
  const connecte = computed(() => utilisateur.value !== null)

  async function verifier(): Promise<void> {
    try {
      utilisateur.value = await api.lire<Utilisateur>('/auth/moi')
    } catch (e) {
      if (!(e instanceof ErreurApi && e.statut === 401)) throw e
      utilisateur.value = null
    } finally {
      verifiee.value = true
    }
  }

  async function deconnecter(): Promise<void> {
    await api.envoyer('/auth/deconnexion', {})
    utilisateur.value = null
  }

  return { utilisateur, verifiee, connecte, verifier, deconnecter }
})

// Mise à jour à chaud en développement : sans cela, un onglet ouvert garde l'ancienne version du store.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useSessionStore, import.meta.hot))
