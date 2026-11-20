<script setup lang="ts">
import { Button } from '@/components/ui/button'

/** Bouton d'action (shadcn-vue) : principal ou secondaire ; en chargement, occupé (aria-busy) et inactif. */
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
  <Button
    :type="type"
    :variant="variante === 'principal' ? 'default' : 'outline'"
    :disabled="disabled || chargement"
    :aria-busy="chargement ? 'true' : undefined"
  >
    <span v-if="chargement" class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
    {{ label }}
  </Button>
</template>
