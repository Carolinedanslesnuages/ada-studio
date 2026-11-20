<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Modele } from '@/lib/projet'
import { useProjetsStore, type DepotAReprendre } from '@/stores/projets'

/**
 * Reprendre un projet existant (#37) : le PO choisit un dépôt de l'organisation ou de son compte
 * (la stack est facultative). ADA lance l'analyse et ouvre aussitôt le projet : le PO y suit
 * l'assistant, puis valide la reprise.
 */
const props = defineProps<{ modeles: Modele[] }>()
const emit = defineEmits<{ annuler: []; lancee: [id: string, analyse: number | null] }>()
const projets = useProjetsStore()

const depots = ref<DepotAReprendre[] | null>(null)
const depot = ref('')
const modele = ref('')
const erreurDepot = ref<string | undefined>()
const erreur = ref<string | null>(null)
const envoiEnCours = ref(false)

const choisi = computed(() => depots.value?.find((candidat) => candidat.id === depot.value) ?? null)
const libelleCompte = (candidat: DepotAReprendre) => (candidat.compte === 'personnel' ? `votre compte ${candidat.proprietaire}` : `organisation ${candidat.proprietaire}`)
const optionsDepots = computed(() =>
  (depots.value ?? []).map((candidat) => ({ value: candidat.id, text: `${candidat.nom} (${libelleCompte(candidat)})` })),
)
/** La stack décrit la structure du code ; l'apparence du projet repris est gardée telle quelle. */
const optionsModeles = computed(() => [
  { value: '', text: 'Je ne sais pas : ADA la déduit' },
  ...props.modeles.filter((m) => m.disponible).map((m) => ({ value: m.id, text: m.libelle })),
])

async function charger(): Promise<void> {
  try {
    depots.value = await projets.aReprendre()
  } catch (e) {
    erreur.value = (e as Error).message
  }
}

onMounted(charger)

async function reprendre(): Promise<void> {
  erreurDepot.value = depot.value ? undefined : 'Choisissez le dépôt à reprendre'
  if (erreurDepot.value || choisi.value?.repriseEnCours || choisi.value?.analyseEnCours) return
  envoiEnCours.value = true
  erreur.value = null
  try {
    const resultat = await projets.reprendre(depot.value, modele.value || null)
    const numero = Number(resultat.analyse?.match(/\/issues\/(\d+)$/)?.[1])
    emit('lancee', resultat.id, Number.isInteger(numero) ? numero : null)
  } catch (e) {
    erreur.value = (e as Error).message
  } finally {
    envoiEnCours.value = false
  }
}
</script>

<template>
  <form novalidate aria-labelledby="titre-reprise" @submit.prevent="reprendre">
    <h2 id="titre-reprise" class="titre-4">Reprendre un projet existant</h2>
    <p class="texte-sm">
      Faites évoluer avec ADA un projet déjà commencé, de l’organisation ou de votre compte GitHub.
      ADA l’analyse comme si elle l’avait créé et vous propose des améliorations
      (tests, accessibilité, règles du projet). ADA ouvre ensuite une pull request de reprise : rien
      ne change dans le projet tant que vous ne l’avez pas validée.
    </p>

    <UiAlerte v-if="erreur" type="error" small :description="erreur" class="mb-3w" />
    <p v-if="depots === null && !erreur" class="texte-sm" role="status">Recherche de vos dépôts…</p>
    <UiAlerte
      v-else-if="depots && depots.length === 0"
      type="info"
      small
      description="Aucun dépôt à reprendre : tous ceux auxquels ADA a accès sont déjà dans l’atelier."
      class="mb-3w"
    />

    <template v-if="depots && depots.length">
      <UiListe
        v-model="depot"
        label="Dépôt à reprendre"
        :options="optionsDepots"
        :error-message="erreurDepot"
        default-unselected-text="Choisissez un dépôt"
      />
      <template v-if="choisi?.repriseEnCours">
        <UiAlerte type="info" small class="mb-2w" description="Une reprise de ce dépôt attend déjà votre validation : fusionnez sa pull request sur GitHub." />
        <p class="mb-3w">
          <a :href="choisi.repriseEnCours" target="_blank" rel="noopener">
            Ouvrir la pull request de reprise <span class="visuellement-cache">(nouvelle fenêtre)</span>
          </a>
        </p>
      </template>
      <UiAlerte
        v-else-if="choisi?.analyseEnCours"
        type="info"
        small
        class="mb-3w"
        description="ADA analyse déjà ce projet : la pull request de reprise s’ouvrira à la fin."
      />
      <template v-else>
        <UiListe
          v-model="modele"
          label="Stack la plus proche (facultatif)"
          hint="Si vous la connaissez, ADA part de sa description pour démarrer l’aperçu."
          :options="optionsModeles"
        />
        <p class="champ__aide">Apparence : ADA studio garde celle du projet et n’ajoute aucune bibliothèque de composants ni de style.</p>
      </template>
    </template>

    <p id="reprise-enregistrement" class="texte-sm">
      <span class="icone icone-information-line icone--sm" aria-hidden="true" />
      <strong>ADA enregistre la demande d’analyse sur GitHub, à votre nom</strong>, puis ajoute s’ils
      manquent les formulaires de story et de signalement, la description de l’aperçu
      (<code>ada.json</code>) et les versions automatiques.
    </p>
    <p class="texte-sm">
      Votre dépôt n’apparaît pas ? ADA doit y avoir accès :
      <a href="https://github.com/settings/installations" target="_blank" rel="noopener">
        autorisez l’application ADA sur ce compte <span class="visuellement-cache">(nouvelle fenêtre)</span>
      </a>.
    </p>

    <p v-if="envoiEnCours" class="texte-sm" role="status">ADA prépare la reprise et lance l’analyse…</p>
    <ul class="groupe-boutons">
      <li v-if="depots && depots.length && !choisi?.repriseEnCours && !choisi?.analyseEnCours">
        <UiBouton type="submit" label="Analyser et reprendre" aria-describedby="reprise-enregistrement" :disabled="envoiEnCours" />
      </li>
      <li><UiBouton type="button" secondary label="Annuler" @click="emit('annuler')" /></li>
    </ul>
  </form>
</template>
