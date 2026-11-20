<script setup lang="ts">
import { useId } from 'vue'

/** Liste déroulante native, avec étiquette, aide et message d'erreur reliés. */
type Option = string | { value: string | number; text: string; disabled?: boolean }
withDefaults(
  defineProps<{ label: string; options: Option[]; hint?: string; errorMessage?: string; defaultUnselectedText?: string; description?: string }>(),
  { hint: undefined, errorMessage: undefined, defaultUnselectedText: 'Choisissez une option', description: undefined },
)
const modele = defineModel<string | number | undefined>()
const id = useId()
const valeur = (option: Option) => (typeof option === 'string' ? option : option.value)
const texte = (option: Option) => (typeof option === 'string' ? option : option.text)
</script>

<template>
  <div class="champ mb-6">
    <label class="champ__etiquette" :for="id">
      {{ label }}
      <span v-if="hint || description" :id="`${id}-aide`" class="champ__aide">{{ hint ?? description }}</span>
    </label>
    <select
      :id="id"
      v-model="modele"
      :class="['champ__saisie cursor-pointer w-full rounded-md border border-solid border-stone-300 bg-white px-3.5 py-2.5 text-base text-[var(--app-texte)] shadow-sm transition focus:border-primaire-500 focus-visible:outline-none', { 'border-red-700 bg-red-50': errorMessage }]"
      :aria-describedby="[hint || description ? `${id}-aide` : '', errorMessage ? `${id}-erreur` : ''].filter(Boolean).join(' ') || undefined"
      :aria-invalid="errorMessage ? 'true' : undefined"
    >
      <option :value="undefined" disabled hidden>{{ defaultUnselectedText }}</option>
      <option v-for="option in options" :key="valeur(option)" :value="valeur(option)" :disabled="typeof option !== 'string' && option.disabled">
        {{ texte(option) }}
      </option>
    </select>
    <p v-if="errorMessage" :id="`${id}-erreur`" class="champ__erreur">{{ errorMessage }}</p>
  </div>
</template>
