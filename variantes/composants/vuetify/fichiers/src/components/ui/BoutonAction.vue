<script setup lang="ts">
/** Bouton d'action (Vuetify) : principal ou secondaire ; en chargement, occupé (aria-busy) et inactif. */
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
  <v-btn
    :type="type"
    color="primary"
    :variant="variante === 'principal' ? 'flat' : 'outlined'"
    :disabled="disabled"
    :loading="chargement"
    :aria-busy="chargement ? 'true' : undefined"
  >
    {{ label }}
    <!-- Défaut connu de Vuetify : sa roue de chargement n'a pas de nom accessible. -->
    <template #loader>
      <v-progress-circular indeterminate size="20" width="2" aria-label="Chargement en cours" />
    </template>
  </v-btn>
</template>
