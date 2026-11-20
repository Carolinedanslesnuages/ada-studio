import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, ErreurApi } from '@/services/api'
import type { Combinaisons, ErreursProjet, FamilleDeProjet, Modele, NouveauProjet, ResultatCreation, TypeDeProjet, ConseilStack } from '@/lib/projet'

export interface Projet {
  /** Identifiant dans ADA : le nom, ou « compte~nom » pour un projet du compte personnel du PO. */
  id: string
  nom: string
  proprietaire: string
  compte: 'organisation' | 'personnel'
  /** Reprise pas encore validée (#37) : analyse en cours, ou PR de reprise à fusionner. */
  reprise: { pullRequest: string | null } | null
  /** Projet repris (pas créé par ADA) : il peut être désynchronisé, sans rien supprimer. */
  repris: boolean
  description: string | null
  prive: boolean
  url: string
  misAJourLe: string | null
}

/** Dépôt existant que le PO peut faire reprendre par ADA (#37). */
export interface DepotAReprendre {
  id: string
  nom: string
  proprietaire: string
  compte: 'organisation' | 'personnel'
  description: string | null
  url: string
  /** PR de reprise déjà ouverte, en attente de fusion. */
  repriseEnCours: string | null
  /** L'assistant analyse le projet ; la PR de reprise s'ouvrira à la fin. */
  analyseEnCours: boolean
}

export interface ResultatReprise {
  /** Identifiant du projet : il apparaît dans ADA dès le lancement de l'analyse. */
  id: string
  /** Demande d'analyse, sur GitHub : bilan et améliorations proposées par l'assistant. */
  analyse: string | null
  pullRequest: string | null
}

export const useProjetsStore = defineStore('projets', () => {
  const liste = ref<Projet[]>([])
  const idCourant = ref<string | null>(null)
  const chargement = ref(false)
  const erreur = ref<string | null>(null)

  const modeles = ref<Modele[]>([])
  const types = ref<TypeDeProjet[]>([])
  const familles = ref<FamilleDeProjet[]>([])
  const combinaisons = ref<Combinaisons | null>(null)

  const courant = computed(() => liste.value.find((p) => p.id === idCourant.value) ?? null)

  async function charger(): Promise<void> {
    chargement.value = true
    erreur.value = null
    try {
      liste.value = await api.lire<Projet[]>('/projets')
      // Aucun projet ouvert à l'arrivée : le PO choisit (rien n'est affiché sans son choix).
      if (idCourant.value && !courant.value) idCourant.value = null
    } catch (e) {
      erreur.value = (e as Error).message
    } finally {
      chargement.value = false
    }
  }

  async function chargerModeles(): Promise<void> {
    if (modeles.value.length > 0) return
    const catalogue = await api.lire<{ familles: FamilleDeProjet[]; types: TypeDeProjet[]; modeles: Modele[]; combinaisons: Combinaisons }>(
      '/projets/modeles',
    )
    familles.value = catalogue.familles
    types.value = catalogue.types
    modeles.value = catalogue.modeles
    combinaisons.value = catalogue.combinaisons ?? null
  }

  /** Crée le projet, l'ajoute en tête et le sélectionne ; renvoie les erreurs de validation éventuelles. */
  /** L'assistant lit l'idée du PO et propose la stack la plus adaptée (#68). */
  function conseillerStack(idee: string): Promise<ConseilStack> {
    return api.envoyer<ConseilStack>('/projets/conseil-stack', { idee })
  }

  async function creer(
    projet: NouveauProjet,
  ): Promise<{ resultat: ResultatCreation } | { erreurs: ErreursProjet }> {
    try {
      const resultat = await api.envoyer<ResultatCreation>('/projets', projet)
      liste.value = [resultat.projet, ...liste.value.filter((p) => p.id !== resultat.projet.id)]
      idCourant.value = resultat.projet.id
      return { resultat }
    } catch (e) {
      if (e instanceof ErreurApi && (e.statut === 400 || e.statut === 409) && e.erreurs) {
        return { erreurs: e.erreurs as ErreursProjet }
      }
      throw e
    }
  }

  function choisir(id: string): void {
    idCourant.value = id
  }

  /** Masque le projet ouvert : il reste dans la liste, rien n'est affiché jusqu'au prochain choix. */
  function fermer(): void {
    idCourant.value = null
  }

  function aReprendre(): Promise<DepotAReprendre[]> {
    return api.lire<DepotAReprendre[]>('/projets/a-reprendre')
  }

  /**
   * L'assistant analyse le projet, puis ADA ouvre la PR de reprise ; le projet apparaît dans la
   * liste une fois qu'elle est fusionnée. La stack est facultative.
   */
  function reprendre(depot: string, modele: string | null): Promise<ResultatReprise> {
    return api.envoyer<ResultatReprise>('/projets/reprendre', { depot, modele })
  }

  return {
    liste,
    modeles,
    combinaisons,
    types,
    familles,
    idCourant,
    courant,
    chargement,
    erreur,
    charger,
    chargerModeles,
    creer,
    conseillerStack,
    choisir,
    fermer,
    aReprendre,
    reprendre,
  }
})

// Mise à jour à chaud en développement : sans cela, un onglet ouvert garde l'ancienne version du store.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useProjetsStore, import.meta.hot))
