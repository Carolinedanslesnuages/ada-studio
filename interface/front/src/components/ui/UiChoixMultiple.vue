<script setup lang="ts">
import { useId } from 'vue'

/** Cases à cocher regroupées sous une légende (plusieurs réponses). */
withDefaults(
  defineProps<{ legend: string; options: { label: string; value: string; id?: string; name?: string; hint?: string }[]; errorMessage?: string }>(),
  { errorMessage: undefined },
)
const modele = defineModel<string[]>({ default: () => [] })
const id = useId()
</script>

<template>
  <fieldset :class="['groupe-choix', { 'groupe-choix--erreur': errorMessage }]" :aria-describedby="errorMessage ? `${id}-erreur` : undefined">
    <legend class="groupe-choix__legende">{{ legend }}</legend>
    <div v-for="(option, rang) in options" :key="option.value" class="choix">
      <input :id="option.id ?? `${id}-${rang}`" v-model="modele" type="checkbox" :name="option.name" :value="option.value" class="choix__saisie mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer accent-primaire-700" />
      <label :for="option.id ?? `${id}-${rang}`" class="choix__etiquette cursor-pointer">
        {{ option.label }}
        <span v-if="option.hint" class="champ__aide">{{ option.hint }}</span>
      </label>
    </div>
    <p v-if="errorMessage" :id="`${id}-erreur`" class="champ__erreur">{{ errorMessage }}</p>
  </fieldset>
</template>
