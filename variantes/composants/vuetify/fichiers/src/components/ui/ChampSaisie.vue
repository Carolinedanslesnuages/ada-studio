<script setup lang="ts">
/** Champ de saisie (Vuetify) : étiquette liée, aide et erreur reliées par Vuetify, obligatoire signalé. */
withDefaults(
  defineProps<{
    label: string
    aide?: string
    erreur?: string
    requis?: boolean
    disabled?: boolean
    type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'password'
  }>(),
  { aide: undefined, erreur: undefined, type: 'text' },
)
const valeur = defineModel<string>({ default: '' })
</script>

<template>
  <v-text-field
    v-model="valeur"
    :label="requis ? `${label} (obligatoire)` : label"
    :type="type"
    :hint="aide"
    :persistent-hint="!disabled"
    :aria-disabled="disabled ? 'true' : undefined"
    :error-messages="erreur ? [erreur] : []"
    :required="requis"
    :disabled="disabled"
    variant="outlined"
    class="mb-4"
  />
</template>
