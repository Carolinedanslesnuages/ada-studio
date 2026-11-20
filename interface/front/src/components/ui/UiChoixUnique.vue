<script setup lang="ts">
/** Boutons radio regroupés sous une légende (une seule réponse). */
withDefaults(
  defineProps<{ legend: string; name: string; options: { label: string; value: string | number; hint?: string; id?: string }[]; errorMessage?: string }>(),
  { errorMessage: undefined },
)
const modele = defineModel<string | number | undefined>()
</script>

<template>
  <fieldset :class="['groupe-choix', { 'groupe-choix--erreur': errorMessage }]" :aria-describedby="errorMessage ? `${name}-erreur` : undefined">
    <legend class="groupe-choix__legende">{{ legend }}</legend>
    <div v-for="(option, rang) in options" :key="option.value" class="choix">
      <input :id="option.id ?? `${name}-${rang}`" v-model="modele" type="radio" :name="name" :value="option.value" class="choix__saisie mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer accent-primaire-700" />
      <label :for="option.id ?? `${name}-${rang}`" class="choix__etiquette cursor-pointer">
        {{ option.label }}
        <span v-if="option.hint" class="champ__aide">{{ option.hint }}</span>
      </label>
    </div>
    <p v-if="errorMessage" :id="`${name}-erreur`" class="champ__erreur">{{ errorMessage }}</p>
  </fieldset>
</template>
