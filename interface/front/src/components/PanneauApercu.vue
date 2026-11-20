<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { api } from '@/services/api'
import LienDemo from '@/components/LienDemo.vue'
import PanneauComposants from '@/components/PanneauComposants.vue'

interface Apercu {
  etat: 'arrete' | 'demarrage' | 'pret' | 'erreur'
  url: string | null
  journal: string | null
}

/**
 * `enAttente` : l'aperçu ne peut pas encore démarrer (reprise à valider) ; le texte l'explique.
 * `reductible` : affiché en grand, avec un bouton pour revenir à la conversation.
 */
const props = defineProps<{ projet: string | null; intervalleMs?: number; signeDeVieMs?: number; enAttente?: string | null; reductible?: boolean }>()
const emit = defineEmits<{ reduire: []; adresse: [url: string | null] }>()

const apercu = ref<Apercu | null>(null)
const erreur = ref<string | null>(null)
const cle = ref(0)

/** Onglets : le produit (l'application), ou ses composants (Storybook du projet). */
const ONGLETS = [
  { id: 'produit', libelle: 'Produit' },
  { id: 'composants', libelle: 'Composants' },
] as const
const onglet = ref<(typeof ONGLETS)[number]['id']>('produit')
/** Clavier : les flèches passent d'un onglet à l'autre (motif ARIA des onglets). */
function changerOnglet(evenement: KeyboardEvent): void {
  if (evenement.key !== 'ArrowRight' && evenement.key !== 'ArrowLeft') return
  const suivant = ONGLETS[(ONGLETS.findIndex((candidat) => candidat.id === onglet.value) + 1) % ONGLETS.length]!
  onglet.value = suivant.id
  document.getElementById(`onglet-${suivant.id}`)?.focus()
}
let minuteur: ReturnType<typeof setTimeout> | null = null

const chemin = (projet: string) => `/projets/${encodeURIComponent(projet)}/apercu`

function arreterSuivi(): void {
  if (minuteur) clearTimeout(minuteur)
  minuteur = null
  if (minuteurVie) clearInterval(minuteurVie)
  minuteurVie = null
}

/*
 * Signe de vie : tant que l'aperçu est affiché, ADA le sait (il n'est pas mis en veille). S'il a
 * été mis en veille entre-temps (onglet resté ouvert la nuit), on le relance de soi-même.
 */
let minuteurVie: ReturnType<typeof setInterval> | null = null
function garderEnVie(projet: string): void {
  if (minuteurVie) clearInterval(minuteurVie)
  minuteurVie = setInterval(async () => {
    if (props.projet !== projet) return
    try {
      const etat = await api.lire<Apercu>(chemin(projet))
      if (etat.etat === 'arrete') void demarrer(projet)
    } catch {
      // réseau momentané : on réessaiera au prochain signe de vie
    }
  }, props.signeDeVieMs ?? 60_000)
}

/** Interroge l'état jusqu'à ce que l'application réponde (ou échoue). */
function suivre(projet: string): void {
  arreterSuivi()
  minuteur = setTimeout(async () => {
    if (props.projet !== projet) return
    try {
      apercu.value = await api.lire<Apercu>(chemin(projet))
      if (apercu.value.etat === 'demarrage') suivre(projet)
    } catch (e) {
      erreur.value = (e as Error).message
    }
  }, props.intervalleMs ?? 3000)
}

async function demarrer(projet: string): Promise<void> {
  erreur.value = null
  apercu.value = { etat: 'demarrage', url: null, journal: null }
  try {
    apercu.value = await api.envoyer<Apercu>(chemin(projet), {})
    if (apercu.value.etat === 'demarrage') suivre(projet)
    garderEnVie(projet)
  } catch (e) {
    apercu.value = null
    erreur.value = (e as Error).message
  }
}

function recharger(): void {
  cle.value++
}

watch(
  () => [props.projet, props.enAttente] as const,
  ([projet, enAttente]) => {
    arreterSuivi()
    apercu.value = null
    if (projet && !enAttente) void demarrer(projet)
  },
  { immediate: true },
)

/* L'atelier propose « Ouvrir dans un onglet » depuis la conversation : il lui faut l'adresse. */
watch(
  () => (apercu.value?.etat === 'pret' ? apercu.value.url : null),
  (url) => emit('adresse', url),
  { immediate: true },
)

onUnmounted(arreterSuivi)
</script>

<template>
  <section class="atelier__panneau" aria-labelledby="titre-apercu">
    <div class="grille grille--middle grille--gutters">
      <h2 id="titre-apercu" class="titre-4 mb-0 col" tabindex="-1">Aperçu</h2>
      <div class="col-auto">
        <ul class="groupe-boutons groupe-boutons--sm">
          <li v-if="reductible">
            <UiBouton size="sm" icon="icone-arrow-left-line" label="Revenir à la conversation" @click="emit('reduire')" />
          </li>
          <template v-if="apercu?.etat === 'pret' && apercu.url">
          <li>
            <UiBouton size="sm" tertiary icon="icone-refresh-line" label="Recharger" @click="recharger" />
          </li>
          <li>
            <a class="bouton bouton--sm bouton--tertiaire" :href="apercu.url" target="_blank" rel="noopener">
              Ouvrir dans un onglet<span class="visuellement-cache"> (nouvelle fenêtre)</span>
            </a>
          </li>
          </template>
        </ul>
      </div>
    </div>

    <div v-if="projet && !enAttente" class="onglets" role="tablist" aria-label="Ce que montre l’aperçu">
      <button
        v-for="candidat in ONGLETS"
        :id="`onglet-${candidat.id}`"
        :key="candidat.id"
        type="button"
        role="tab"
        class="onglets__onglet"
        :aria-selected="onglet === candidat.id ? 'true' : 'false'"
        :aria-controls="`panneau-${candidat.id}`"
        :tabindex="onglet === candidat.id ? 0 : -1"
        @click="onglet = candidat.id"
        @keydown="changerOnglet"
      >
        {{ candidat.libelle }}
      </button>
    </div>

    <div v-if="projet && !enAttente && onglet === 'composants'" id="panneau-composants" class="onglets__panneau" role="tabpanel" aria-labelledby="onglet-composants">
      <PanneauComposants v-if="apercu?.etat === 'pret'" :projet="projet" />
      <p v-else class="apercu" role="status">Les composants s’affichent dès que l’aperçu est prêt.</p>
    </div>

    <div v-else class="onglets__panneau" :id="projet && !enAttente ? 'panneau-produit' : undefined" :role="projet && !enAttente ? 'tabpanel' : undefined" :aria-labelledby="projet && !enAttente ? 'onglet-produit' : undefined">
    <LienDemo v-if="projet" :projet="projet" :apercu-pret="apercu?.etat === 'pret'" />

    <iframe
      v-if="apercu?.etat === 'pret' && apercu.url"
      :key="cle"
      class="apercu apercu--cadre"
      :src="apercu.url"
      :title="`Aperçu de l’application ${projet}`"
    />

    <div v-else class="apercu" role="status">
      <p v-if="!projet">Choisissez un projet pour afficher son aperçu.</p>
      <p v-else-if="enAttente">{{ enAttente }}</p>
      <UiAlerte v-else-if="erreur" type="error" small :description="erreur" />
      <div v-else-if="apercu?.etat === 'erreur'">
        <UiAlerte
          type="error"
          small
          description="L’application ne démarre pas. Si le problème persiste, prévenez un développeur avec le journal ci-dessous."
        />
        <pre v-if="apercu.journal" class="texte-xs mt-2w journal">{{ apercu.journal }}</pre>
        <UiBouton class="mt-2w" size="sm" label="Réessayer" @click="demarrer(projet)" />
      </div>
      <p v-else>
        Préparation de l’aperçu de « {{ projet }} »… La première fois, l’installation prend
        une à deux minutes.
      </p>
    </div>
    </div>
  </section>
</template>
