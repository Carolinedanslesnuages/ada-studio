<script setup lang="ts">
/** Tableau de données : légende (visible ou non), en-têtes de colonnes, lignes. */
defineProps<{ title: string; headers: string[]; rows: (string | number)[][]; noCaption?: boolean }>()
</script>

<template>
  <div class="tableau mb-6 overflow-x-auto rounded-lg border border-solid border-primaire-100 bg-white shadow-sm">
    <table class="w-full border-collapse text-left">
      <caption :class="noCaption ? 'visuellement-cache' : 'px-4 pt-4 pb-2 text-left text-lg font-bold'">{{ title }}</caption>
      <thead class="bg-primaire-50">
        <tr><th v-for="entete in headers" :key="entete" scope="col" class="px-4 py-3 text-sm font-semibold text-primaire-900">{{ entete }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="(ligne, rang) in rows" :key="rang" class="border-0 border-t border-solid border-primaire-100 even:bg-primaire-50/40">
          <td v-for="(cellule, colonne) in ligne" :key="colonne" class="px-4 py-3">{{ cellule }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
