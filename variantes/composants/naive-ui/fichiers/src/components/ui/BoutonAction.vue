<script setup lang="ts">
import { NButton } from 'naive-ui'

/** Bouton d'action (Naive UI) : principal ou secondaire ; en chargement, occupé (aria-busy) et inactif. */
withDefaults(
  defineProps<{
    label: string
    variante?: 'principal' | 'secondaire'
    type?: 'button' | 'submit'
    disabled?: boolean
    chargement?: boolean
  }>(),
  { variante: 'principal', type: 'button' },
)
</script>

<template>
  <NButton
    :attr-type="type"
    type="primary"
    :ghost="variante === 'secondaire'"
    :disabled="disabled"
    :loading="chargement"
    :aria-busy="chargement ? 'true' : undefined"
  >
    {{ label }}
  </NButton>
</template>
