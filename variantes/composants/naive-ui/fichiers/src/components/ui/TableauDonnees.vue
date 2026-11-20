<script setup lang="ts">
import { computed } from 'vue'
import { NDataTable } from 'naive-ui'

/** Tableau de données (Naive UI) : titre, en-têtes de colonnes, état de chargement et message si vide. */
const props = withDefaults(
  defineProps<{
    titre: string
    colonnes: { cle: string; libelle: string }[]
    lignes: Record<string, string | number>[]
    chargement?: boolean
    messageVide?: string
  }>(),
  { messageVide: 'Aucune donnée pour le moment.' },
)
const colonnesNaive = computed(() => props.colonnes.map((colonne) => ({ key: colonne.cle, title: colonne.libelle })))
</script>

<template>
  <section class="tableau" :aria-busy="chargement ? 'true' : undefined">
    <h2 class="tableau__titre">{{ titre }}</h2>
    <NDataTable :columns="colonnesNaive" :data="lignes" :loading="chargement">
      <template #empty>{{ messageVide }}</template>
    </NDataTable>
  </section>
</template>

<style scoped>
.tableau {
  margin-bottom: 1.5rem;
}

.tableau__titre {
  font-size: 1rem;
}
</style>
