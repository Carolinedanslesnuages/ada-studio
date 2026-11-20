import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, ErreurApi } from '@/services/api'
import {
  STATUTS_ACTIFS,
  type Activite,
  type DetailStory,
  type Personne,
  type StoryProposee,
  type ResumeStory,
  type Verification,
} from '@/lib/story'

export const useStoriesStore = defineStore('stories', () => {
  const liste = ref<ResumeStory[]>([])
  const courante = ref<DetailStory | null>(null)
  const chargement = ref(false)
  const erreur = ref<string | null>(null)
  const erreurLancement = ref<string | null>(null)
  const activite = ref<Activite | null>(null)
  const verification = ref<Verification | null>(null)
  const erreurAction = ref<string | null>(null)
  /** Développeurs assignables du projet courant (lus à la demande). */
  const developpeurs = ref<Personne[] | null>(null)

  /** La demande qui occupe le projet : tant qu'elle existe, on n'en lance pas d'autre. */
  /** Liste principale : ce qui reste à faire ou est en cours. */
  const aFaire = computed(() => liste.value.filter((story) => story.statut !== 'livree'))
  /** Stories livrées, de la plus récente à la plus ancienne. */
  const livrees = computed(() =>
    liste.value
      .filter((story) => story.statut === 'livree')
      .sort((premiere, seconde) => (seconde.fermeeLe ?? '').localeCompare(premiere.fermeeLe ?? '')),
  )
  const active = computed(() => liste.value.find((s) => STATUTS_ACTIFS.includes(s.statut)) ?? null)

  const chemin = (projet: string) => `/projets/${encodeURIComponent(projet)}/stories`

  async function charger(projet: string, garderCourante = false): Promise<void> {
    chargement.value = !garderCourante
    erreur.value = null
    if (!garderCourante) {
      courante.value = null
      developpeurs.value = null // autre projet : autres personnes assignables
    }
    try {
      liste.value = await api.lire<ResumeStory[]>(chemin(projet))
    } catch (e) {
      if (!garderCourante) liste.value = []
      erreur.value = (e as Error).message
    } finally {
      chargement.value = false
    }
  }

  async function ouvrir(projet: string, numero: number): Promise<void> {
    erreur.value = null
    erreurLancement.value = null
    if (courante.value?.numero !== numero) {
      activite.value = null
      verification.value = null
    }
    try {
      courante.value = await api.lire<DetailStory>(`${chemin(projet)}/${numero}`)
    } catch (e) {
      erreur.value = (e as Error).message
    }
  }

  async function lancer(projet: string, numero: number): Promise<void> {
    erreurLancement.value = null
    try {
      // Ce que le PO a sous les yeux : ADA refuse de lancer sans cette empreinte, ou si l'issue a été modifiée sur GitHub depuis.
      if (courante.value?.numero !== numero) await ouvrir(projet, numero)
      const empreinte = courante.value?.empreinte
      await api.envoyer<ResumeStory>(`${chemin(projet)}/${numero}/lancer`, { empreinte })
      await charger(projet, true)
      await ouvrir(projet, numero)
      await chargerActivite(projet, numero)
    } catch (e) {
      const message = (e as Error).message
      // Demande modifiée entre-temps (ou autre conflit) : on montre la version actuelle, à relire avant de relancer.
      if (e instanceof ErreurApi && e.statut === 409) await ouvrir(projet, numero)
      erreurLancement.value = message
    }
  }

  async function chargerActivite(projet: string, numero: number): Promise<void> {
    try {
      activite.value = await api.lire<Activite>(`${chemin(projet)}/${numero}/activite`)
    } catch {
      /* activité indisponible : on garde la précédente */
    }
  }

  async function chargerVerification(projet: string, numero: number): Promise<void> {
    try {
      verification.value = await api.lire<Verification>(`${chemin(projet)}/${numero}/verification`)
    } catch {
      /* indisponible : on garde la précédente */
    }
  }

  /** Relance les contrôles que GitHub n'avait pas lancés (facturation réglée entre-temps). */
  async function relancerControles(projet: string, numero: number): Promise<void> {
    erreurAction.value = null
    try {
      verification.value = await api.envoyer<Verification>(`${chemin(projet)}/${numero}/controles/relancer`, {})
    } catch (e) {
      erreurAction.value = (e as Error).message
    }
  }

  /** Fusionne la demande (contrôles verts) : elle devient livrée, la suivante peut être lancée. */
  async function fusionner(projet: string, numero: number): Promise<void> {
    erreurAction.value = null
    try {
      verification.value = await api.envoyer<Verification>(`${chemin(projet)}/${numero}/fusionner`, {})
      await charger(projet, true)
      // Livrée : elle rejoint « Déjà livrées » et son détail se ferme.
      if (liste.value.find((story) => story.numero === numero)?.statut === 'livree') {
        fermer()
        return
      }
      await ouvrir(projet, numero)
      await chargerActivite(projet, numero)
    } catch (e) {
      erreurAction.value = (e as Error).message
    }
  }

  /** Relit la demande ouverte, son activité et la liste (statuts changés par l'assistant). */
  async function suivre(projet: string): Promise<void> {
    const numero = courante.value?.numero
    if (!numero) return
    await Promise.all([chargerActivite(projet, numero), charger(projet, true)])
    if (courante.value?.statut === 'en-verification') await chargerVerification(projet, numero)
    const resume = liste.value.find((s) => s.numero === numero)
    if (resume && resume.statut !== courante.value?.statut) await ouvrir(projet, numero)
    else if (courante.value?.numero === numero) {
      courante.value = await api.lire<DetailStory>(`${chemin(projet)}/${numero}`).catch(() => courante.value)
    }
  }

  async function agir(projet: string, numero: number, action: () => Promise<unknown>): Promise<void> {
    erreurAction.value = null
    try {
      await action()
      await ouvrir(projet, numero)
      await chargerActivite(projet, numero)
      await charger(projet, true)
    } catch (e) {
      erreurAction.value = (e as Error).message
    }
  }

  const validerPlan = (projet: string, numero: number) =>
    agir(projet, numero, () => api.envoyer(`${chemin(projet)}/${numero}/plan/valider`, {}))

  /** Mode sauvage : enregistre le prompt (issue), le lance et l'ouvre ; renvoie l'erreur éventuelle. */
  async function prompter(projet: string, texte: string): Promise<string | null> {
    try {
      const demande = await api.envoyer<ResumeStory>(`${chemin(projet)}/prompt`, { texte })
      await charger(projet, true)
      await ouvrir(projet, demande.numero)
      await chargerActivite(projet, demande.numero)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  /** Conversation (« vrai prompt ») : le premier message ouvre l'issue, ADA répond en agissant. */
  async function ouvrirConversation(projet: string, texte: string): Promise<string | null> {
    try {
      const conversation = await api.envoyer<ResumeStory>(`${chemin(projet)}/conversation`, { texte })
      await charger(projet, true)
      await ouvrir(projet, conversation.numero)
      await chargerActivite(projet, conversation.numero)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }
  const envoyerMessage = (projet: string, numero: number, texte: string) =>
    agir(projet, numero, () => api.envoyer(`${chemin(projet)}/${numero}/conversation/message`, { texte }))
  /** « C'est bon » : ADA propose les changements au projet (PR), ou ferme s'il n'y en a pas. */
  const terminerConversation = (projet: string, numero: number) =>
    agir(projet, numero, () => api.envoyer(`${chemin(projet)}/${numero}/conversation/terminer`, {}))
  const arreterConversation = (projet: string, numero: number) =>
    agir(projet, numero, () => api.envoyer(`${chemin(projet)}/${numero}/conversation/arreter`, {}))

  const relancer = (projet: string, numero: number) =>
    agir(projet, numero, () => api.envoyer(`${chemin(projet)}/${numero}/relancer`, {}))

  /** Découpage validé : ADA publie les stories relues par le PO ; la demande devient leur parent (#36). */
  const creerDecoupage = (projet: string, numero: number, stories: StoryProposee[]) =>
    agir(projet, numero, () => api.envoyer(`${chemin(projet)}/${numero}/decoupage`, { stories }))

  /** Réponse aux questions, ou modification demandée sur le plan. */
  const repondre = (projet: string, numero: number, texte: string) =>
    agir(projet, numero, () => api.envoyer(`${chemin(projet)}/${numero}/reponse`, { texte }))

  function fermer(): void {
    courante.value = null
    activite.value = null
    verification.value = null
  }

  async function chargerDeveloppeurs(projet: string): Promise<void> {
    erreurAction.value = null
    try {
      developpeurs.value = await api.lire<Personne[]>(`${chemin(projet)}/developpeurs`)
    } catch (e) {
      erreurAction.value = (e as Error).message
    }
  }

  /** Assigne un développeur à la demande ouverte (null : retire l'assignation). */
  async function assigner(projet: string, numero: number, login: string | null): Promise<void> {
    erreurAction.value = null
    try {
      courante.value = await api.envoyer<DetailStory>(`${chemin(projet)}/${numero}/assigner`, { login })
    } catch (e) {
      erreurAction.value = (e as Error).message
    }
  }

  return {
    creerDecoupage,
    developpeurs,
    chargerDeveloppeurs,
    assigner,
    liste,
    aFaire,
    livrees,
    courante,
    active,
    chargement,
    erreur,
    erreurLancement,
    activite,
    verification,
    erreurAction,
    chargerVerification,
    fusionner,
    relancerControles,
    charger,
    chargerActivite,
    suivre,
    validerPlan,
    relancer,
    prompter,
    ouvrirConversation,
    envoyerMessage,
    terminerConversation,
    arreterConversation,
    ouvrir,
    lancer,
    repondre,
    fermer,
  }
})

// Mise à jour à chaud en développement : sans cela, un onglet ouvert garde l'ancienne version du store.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useStoriesStore, import.meta.hot))
