<script setup lang="ts">
/** Tableau de données : titre (caption), en-têtes de colonnes, état de chargement et message si vide. */
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
  <div class="tableau" :aria-busy="chargement ? 'true' : undefined">
    <table>
      <caption>{{ titre }}</caption>
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
    </table>
  </div>
</template>

<style scoped>
.tableau {
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

caption {
  margin-bottom: 0.5rem;
  font-weight: 700;
  text-align: left;
}

th,
td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--app-bordure);
  text-align: left;
}

thead th {
  background: var(--app-fond-doux);
}
</style>
