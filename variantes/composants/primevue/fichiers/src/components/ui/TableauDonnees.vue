<script setup lang="ts">
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'

/** Tableau de données (PrimeVue) : titre, en-têtes de colonnes, état de chargement et message si vide. */
withDefaults(
  defineProps<{
    titre: string
    colonnes: { cle: string; libelle: string }[]
    lignes: Record<string, string | number>[]
    chargement?: boolean
    messageVide?: string
  }>(),
  { messageVide: 'Aucune donnée pour le moment.' },
)
</script>

<template>
  <section class="tableau" :aria-busy="chargement ? 'true' : undefined">
    <h2 class="tableau__titre">{{ titre }}</h2>
    <DataTable :value="lignes" :loading="chargement" :table-props="{ 'aria-label': titre }">
      <Column v-for="colonne in colonnes" :key="colonne.cle" :field="colonne.cle" :header="colonne.libelle" />
      <template #empty>{{ messageVide }}</template>
    </DataTable>
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
