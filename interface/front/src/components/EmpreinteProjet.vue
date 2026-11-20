<script setup lang="ts">
import { ref, watch } from 'vue'
import { api } from '@/services/api'
import { enStreaming, formaterCo2, type Empreinte } from '@/lib/empreinte'

/**
 * Empreinte carbone estimée du projet, toutes demandes confondues : relue à chaque retour à
 * l'accueil du projet. Rien ne s'affiche tant qu'ADA n'y a pas travaillé.
 */
const props = defineProps<{ projet: string }>()

const total = ref<{ empreinte: Empreinte; demandes: number; equivalents: { streamingHeureG: number } } | null>(null)

async function lire(): Promise<void> {
  try {
    total.value = await api.lire(`/projets/${encodeURIComponent(props.projet)}/empreinte`)
  } catch {
    total.value = null
  }
}
watch(() => props.projet, () => void lire(), { immediate: true })
</script>

<template>
  <p v-if="total" class="texte-xs empreinte-projet" data-testid="empreinte-projet">
    <span class="icone icone-leaf-line icone--sm" aria-hidden="true" />
    Empreinte estimée de ce projet : {{ formaterCo2(total.empreinte.co2g) }}, soit
    {{ enStreaming(total.empreinte.co2g, total.equivalents.streamingHeureG) }}, pour
    {{ total.demandes }} {{ total.demandes > 1 ? 'demandes' : 'demande' }}.
    <RouterLink to="/indicateurs">Comment c’est calculé</RouterLink>
  </p>
</template>

<style scoped>
.empreinte-projet {
  text-align: center;
  color: var(--app-texte-doux);
  margin: 0;
}
</style>
