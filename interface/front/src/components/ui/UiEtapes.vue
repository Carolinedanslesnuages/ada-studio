<script setup lang="ts">
import { computed } from 'vue'

/** Indicateur d'étapes : le titre dit l'étape en cours et sa position (« Étape 2 sur 3 ») ; la barre le montre. */
const props = defineProps<{ steps: string[]; currentStep: number }>()
const suivante = computed(() => props.steps[props.currentStep] ?? null)
</script>

<template>
  <div class="etapes mb-6">
    <h2 class="etapes__titre m-0 text-xl font-semibold">
      {{ steps[currentStep - 1] }}
      <span class="etapes__etat mt-1 block text-sm font-normal text-[var(--app-texte-doux)]">Étape {{ currentStep }} sur {{ steps.length }}</span>
    </h2>
    <div class="etapes__barre my-3 flex gap-1" aria-hidden="true">
      <span
        v-for="(etape, rang) in steps"
        :key="etape"
        :class="['h-1.5 flex-1 rounded-full', rang < currentStep ? 'bg-primaire-700' : 'bg-[var(--app-bordure)]']"
      />
    </div>
    <p v-if="suivante" class="etapes__suivante m-0 text-sm text-[var(--app-texte-doux)]">
      <span class="font-semibold">Étape suivante :</span> {{ suivante }}
    </p>
  </div>
</template>
