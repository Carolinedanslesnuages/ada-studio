<script setup lang="ts">
import { libelleCategorie, type Lieu } from '@/lib/lieux'

/** La liste des lieux : l'alternative accessible à la carte, et l'endroit où l'on choisit un lieu. */
defineProps<{ lieux: Lieu[]; lieuChoisi: string | null }>()
const emit = defineEmits<{ choisir: [id: string] }>()
</script>

<template>
  <ul class="liste-sobre liste-lieux">
    <li v-for="lieu in lieux" :key="lieu.id" class="lieu" :class="{ 'lieu--choisi': lieu.id === lieuChoisi }">
      <h3 class="lieu__nom">{{ lieu.nom }}</h3>
      <p class="texte-petit">{{ libelleCategorie(lieu.categorie) }} — {{ lieu.adresse }}</p>
      <p v-if="lieu.description" class="texte-petit">{{ lieu.description }}</p>
      <button
        type="button"
        class="lieu__bouton"
        :aria-label="`Voir ${lieu.nom} sur la carte`"
        :aria-pressed="lieu.id === lieuChoisi ? 'true' : 'false'"
        @click="emit('choisir', lieu.id)"
      >
        {{ lieu.id === lieuChoisi ? 'Affiché sur la carte' : 'Voir sur la carte' }}
      </button>
    </li>
  </ul>
</template>

<style scoped>
.lieu {
  margin-bottom: 1rem;
  padding-left: 0.75rem;
  border-left: 4px solid transparent;
}

.lieu--choisi {
  border-left-color: var(--app-primaire);
}

.lieu__nom {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.lieu p {
  margin: 0 0 0.25rem;
}

.lieu__bouton {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--app-primaire);
  border-radius: var(--app-rayon);
  background: var(--app-fond);
  color: var(--app-primaire);
  font: inherit;
  cursor: pointer;
}

.lieu__bouton[aria-pressed='true'] {
  background: var(--app-primaire);
  color: var(--app-sur-primaire);
}
</style>
