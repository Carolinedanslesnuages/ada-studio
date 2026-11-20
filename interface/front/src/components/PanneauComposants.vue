<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { api } from '@/services/api'

interface Composants {
  etat: 'indisponible' | 'arrete' | 'demarrage' | 'pret'
  url: string | null
}

/**
 * Onglet « Composants » : le Storybook du projet, lancé dans le conteneur de l'aperçu. On y voit
 * chaque composant et ses états (normal, focus, erreur, chargement…) sans lire de code.
 */
const props = defineProps<{ projet: string; intervalleMs?: number }>()

const composants = ref<Composants | null>(null)
const erreur = ref<string | null>(null)
let minuteur: ReturnType<typeof setTimeout> | null = null
const chemin = () => `/projets/${encodeURIComponent(props.projet)}/apercu/composants`

function arreterSuivi(): void {
  if (minuteur) clearTimeout(minuteur)
  minuteur = null
}

function suivre(): void {
  arreterSuivi()
  minuteur = setTimeout(async () => {
    try {
      composants.value = await api.lire<Composants>(chemin())
      if (composants.value.etat === 'demarrage') suivre()
    } catch (e) {
      erreur.value = (e as Error).message
    }
  }, props.intervalleMs ?? 3000)
}

async function afficher(): Promise<void> {
  erreur.value = null
  try {
    composants.value = await api.envoyer<Composants>(chemin(), {})
    if (composants.value.etat === 'demarrage') suivre()
  } catch (e) {
    erreur.value = (e as Error).message
  }
}

watch(
  () => props.projet,
  async () => {
    arreterSuivi()
    composants.value = null
    erreur.value = null
    try {
      composants.value = await api.lire<Composants>(chemin())
      if (composants.value.etat === 'arrete') await afficher()
    } catch (e) {
      erreur.value = (e as Error).message
    }
  },
  { immediate: true },
)

onUnmounted(arreterSuivi)
</script>

<template>
  <iframe
    v-if="composants?.etat === 'pret' && composants.url"
    class="apercu apercu--cadre"
    :src="composants.url"
    :title="`Composants du projet ${projet}`"
  />
  <div v-else class="apercu" role="status">
    <UiAlerte v-if="erreur" type="error" small :description="erreur" />
    <p v-else-if="composants?.etat === 'indisponible'">Ce projet n’a pas d’écrans : il n’a pas de composants à montrer.</p>
    <p v-else>
      Préparation des composants de « {{ projet }} »… Storybook démarre dans l’aperçu : une trentaine
      de secondes la première fois.
    </p>
  </div>
</template>
