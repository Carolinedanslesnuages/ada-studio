<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { api } from '@/services/api'

interface Demo {
  etat: 'arrete' | 'demarrage' | 'pret' | 'erreur'
  url: string | null
  apercuDemarre: boolean
}

/**
 * Lien de démonstration à partager : la dernière version validée du projet, ouverte à tous
 * sans connexion (données fictives uniquement, règle d'ADA).
 */
const props = defineProps<{ projet: string; apercuPret: boolean; intervalleMs?: number }>()

const demo = ref<Demo | null>(null)
const erreur = ref<string | null>(null)
const message = ref('')
let minuteur: ReturnType<typeof setTimeout> | null = null

const chemin = computed(() => `/projets/${encodeURIComponent(props.projet)}/demo`)
const disponible = computed(() => props.apercuPret && demo.value?.etat === 'pret' && Boolean(demo.value.url))
const enPreparation = computed(() => demo.value?.etat === 'demarrage')
const explication = computed(() => {
  if (!props.apercuPret) return 'Disponible quand l’aperçu du projet est démarré.'
  if (enPreparation.value) return 'Préparation du lien de démonstration… (une à deux minutes la première fois)'
  if (demo.value?.etat === 'erreur') return 'Le lien de démonstration ne démarre pas : réessayez, ou prévenez un développeur.'
  return 'Montre la dernière version validée (pas le travail en cours), ouverte à tous sans connexion.'
})

function arreterSuivi(): void {
  if (minuteur) clearTimeout(minuteur)
  minuteur = null
}

function suivre(): void {
  arreterSuivi()
  minuteur = setTimeout(async () => {
    try {
      demo.value = await api.lire<Demo>(chemin.value)
      if (demo.value.etat === 'demarrage') suivre()
    } catch (e) {
      erreur.value = (e as Error).message
    }
  }, props.intervalleMs ?? 3000)
}

async function lire(): Promise<void> {
  try {
    demo.value = await api.lire<Demo>(chemin.value)
    if (demo.value.etat === 'demarrage') suivre()
  } catch (e) {
    erreur.value = (e as Error).message
  }
}

async function preparer(): Promise<void> {
  erreur.value = null
  demo.value = { etat: 'demarrage', url: null, apercuDemarre: true }
  try {
    demo.value = await api.envoyer<Demo>(chemin.value, {})
    if (demo.value.etat === 'demarrage') suivre()
  } catch (e) {
    demo.value = null
    erreur.value = (e as Error).message
  }
}

async function copier(): Promise<void> {
  if (!demo.value?.url) return
  try {
    await navigator.clipboard.writeText(demo.value.url)
    message.value = `Lien copié : ${demo.value.url}`
  } catch {
    message.value = `Copiez ce lien : ${demo.value.url}`
  }
}

watch(
  () => [props.projet, props.apercuPret] as const,
  () => {
    arreterSuivi()
    message.value = ''
    erreur.value = null
    if (props.apercuPret) void lire()
    else demo.value = null
  },
  { immediate: true },
)
onUnmounted(arreterSuivi)
</script>

<template>
  <div class="lien-demo mb-2w">
    <UiBouton
      v-if="disponible"
      size="sm"
      secondary
      icon="icone-links-line"
      label="Copier le lien de démonstration"
      aria-describedby="lien-demo-aide"
      @click="copier"
    />
    <UiBouton
      v-else-if="apercuPret && !enPreparation && demo?.etat !== undefined"
      size="sm"
      secondary
      icon="icone-links-line"
      label="Préparer le lien de démonstration"
      aria-describedby="lien-demo-aide"
      @click="preparer"
    />
    <UiBouton
      v-else
      size="sm"
      secondary
      icon="icone-links-line"
      label="Copier le lien de démonstration"
      aria-describedby="lien-demo-aide"
      disabled
    />
    <p id="lien-demo-aide" class="champ__aide mt-1v mb-0">
      {{ explication }}
      <a v-if="disponible && demo?.url" class="lien lien--sm" :href="demo.url" target="_blank" rel="noopener">
        {{ demo.url }}<span class="visuellement-cache"> (nouvelle fenêtre)</span>
      </a>
    </p>
    <p class="texte-sm mb-0" role="status">{{ message }}</p>
    <UiAlerte v-if="erreur" type="error" small :description="erreur" class="mt-1w" />
  </div>
</template>
