<script setup lang="ts">
/** Tableau de données (Vuetify) : titre, en-têtes de colonnes, état de chargement et message si vide. */
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
  <v-table class="mb-6" :aria-busy="chargement ? 'true' : undefined">
    <caption class="text-left font-weight-bold pa-2">{{ titre }}</caption>
    <thead>
      <tr>
        <th v-for="colonne in colonnes" :key="colonne.cle" scope="col">{{ colonne.libelle }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="chargement">
        <td :colspan="colonnes.length">Chargement…</td>
      </tr>
      <tr v-else-if="!lignes.length">
        <td :colspan="colonnes.length">{{ messageVide }}</td>
      </tr>
      <template v-else>
        <tr v-for="(ligne, rang) in lignes" :key="rang">
          <td v-for="colonne in colonnes" :key="colonne.cle">{{ ligne[colonne.cle] }}</td>
        </tr>
      </template>
    </tbody>
  </v-table>
</template>
