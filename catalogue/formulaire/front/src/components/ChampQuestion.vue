<script setup lang="ts">
import { computed } from 'vue'
import type { Question, Valeur } from '@/services/formulaire'

/** Une question du formulaire, rendue avec le champ HTML adapté à son type (étiquette, aide et erreur reliées). */
const props = defineProps<{ question: Question; erreur?: string }>()
const valeur = defineModel<Valeur | undefined>()

const identifiant = computed(() => `question-${props.question.id}`)
const libelle = computed(() => props.question.libelle + (props.question.obligatoire ? ' (obligatoire)' : ''))
const options = computed(() =>
  (props.question.choix ?? []).map((choix, rang) => ({ id: `${identifiant.value}-${rang}`, label: choix, value: choix })),
)
const typeChamp = computed(
  () => ({ courriel: 'email', telephone: 'tel', nombre: 'number', date: 'date' })[props.question.type as string] ?? 'text',
)
const autocompletion = computed(
  () => ({ courriel: 'email', telephone: 'tel' })[props.question.type as string] ?? (props.question.id === 'nom' ? 'name' : undefined),
)
const decrit = computed(
  () =>
    [props.question.aide ? `${identifiant.value}-aide` : '', props.erreur ? `${identifiant.value}-erreur` : '']
      .filter(Boolean)
      .join(' ') || undefined,
)
const texte = computed({
  get: () => (typeof valeur.value === 'string' || typeof valeur.value === 'number' ? String(valeur.value) : ''),
  set: (nouvelle: string) => (valeur.value = nouvelle),
})
const choixMultiples = computed({
  get: () => (Array.isArray(valeur.value) ? valeur.value : []),
  set: (nouveaux: string[]) => (valeur.value = nouveaux.map(String)),
})
const choixUnique = computed({
  get: () => (typeof valeur.value === 'string' ? valeur.value : undefined),
  set: (nouveau: string | undefined) => (valeur.value = nouveau),
})
</script>

<template>
  <fieldset
    v-if="question.type === 'choix-unique' || question.type === 'choix-multiple'"
    :id="identifiant"
    class="groupe-choix"
    :aria-describedby="decrit"
  >
    <legend>{{ libelle }}</legend>
    <p v-if="question.aide" :id="`${identifiant}-aide`" class="aide">{{ question.aide }}</p>
    <div v-for="option in options" :key="option.id" class="choix">
      <input
        v-if="question.type === 'choix-unique'"
        :id="option.id"
        v-model="choixUnique"
        type="radio"
        :name="identifiant"
        :value="option.value"
        :required="question.obligatoire"
      />
      <input v-else :id="option.id" v-model="choixMultiples" type="checkbox" :name="identifiant" :value="option.value" />
      <label :for="option.id">{{ option.label }}</label>
    </div>
    <p v-if="erreur" :id="`${identifiant}-erreur`" class="erreur-champ">{{ erreur }}</p>
  </fieldset>
  <div v-else>
    <label :for="identifiant" class="etiquette">{{ libelle }}</label>
    <p v-if="question.aide" :id="`${identifiant}-aide`" class="aide">{{ question.aide }}</p>
    <textarea
      v-if="question.type === 'texte-long'"
      :id="identifiant"
      v-model="texte"
      class="saisie"
      :required="question.obligatoire"
      :aria-invalid="erreur ? 'true' : undefined"
      :aria-describedby="decrit"
    />
    <input
      v-else
      :id="identifiant"
      v-model="texte"
      class="saisie"
      :type="typeChamp"
      :autocomplete="autocompletion"
      :required="question.obligatoire"
      :aria-invalid="erreur ? 'true' : undefined"
      :aria-describedby="decrit"
    />
    <p v-if="erreur" :id="`${identifiant}-erreur`" class="erreur-champ">{{ erreur }}</p>
  </div>
</template>
