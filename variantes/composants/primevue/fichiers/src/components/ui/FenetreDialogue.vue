<script setup lang="ts">
import Dialog from 'primevue/dialog'

/** Fenêtre de dialogue modale (PrimeVue) : focus piégé, Échap la ferme, focus rendu ensuite. */
defineProps<{ titre: string }>()
const ouvert = defineModel<boolean>('ouvert', { default: false })
</script>

<template>
  <Dialog v-model:visible="ouvert" :header="titre" modal :style="{ width: 'min(32rem, 100%)' }" :close-button-props="{ 'aria-label': 'Fermer' }">
    <slot />
    <template #footer>
      <slot name="actions" />
    </template>
  </Dialog>
</template>
