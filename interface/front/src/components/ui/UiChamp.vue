<script setup lang="ts">
import { useId } from 'vue'

/** Champ de saisie (ou zone de texte) avec étiquette visible, aide et message d'erreur reliés. */
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{ label: string; hint?: string; errorMessage?: string; isTextarea?: boolean; labelVisible?: boolean; id?: string }>(),
  { hint: undefined, errorMessage: undefined, id: undefined },
)
const modele = defineModel<string>({ default: '' })
const genere = useId()
</script>

<template>
  <div class="champ mb-6">
    <label class="champ__etiquette" :for="id ?? genere">
      {{ label }}
      <span v-if="hint" :id="`${id ?? genere}-aide`" class="champ__aide">{{ hint }}</span>
    </label>
    <textarea
      v-if="isTextarea"
      :id="id ?? genere"
      v-model="modele"
      v-bind="$attrs"
      :class="['champ__saisie min-h-32 resize-y w-full rounded-md border border-solid border-stone-300 bg-white px-3.5 py-2.5 text-base text-[var(--app-texte)] shadow-sm transition focus:border-primaire-500 focus-visible:outline-none', { 'border-red-700 bg-red-50': errorMessage }]"
      :aria-describedby="[hint ? `${id ?? genere}-aide` : '', errorMessage ? `${id ?? genere}-erreur` : ''].filter(Boolean).join(' ') || undefined"
      :aria-invalid="errorMessage ? 'true' : undefined"
    />
    <input
      v-else
      :id="id ?? genere"
      v-model="modele"
      v-bind="$attrs"
      :class="['champ__saisie w-full rounded-md border border-solid border-stone-300 bg-white px-3.5 py-2.5 text-base text-[var(--app-texte)] shadow-sm transition focus:border-primaire-500 focus-visible:outline-none', { 'border-red-700 bg-red-50': errorMessage }]"
      :aria-describedby="[hint ? `${id ?? genere}-aide` : '', errorMessage ? `${id ?? genere}-erreur` : ''].filter(Boolean).join(' ') || undefined"
      :aria-invalid="errorMessage ? 'true' : undefined"
    />
    <p v-if="errorMessage" :id="`${id ?? genere}-erreur`" class="champ__erreur">{{ errorMessage }}</p>
  </div>
</template>
