<script setup lang="ts">
/** Fenêtre de dialogue modale (Vuetify) : focus piégé, Échap la ferme, focus rendu ensuite. */
defineProps<{ titre: string }>()
const ouvert = defineModel<boolean>('ouvert', { default: false })
</script>

<template>
  <v-dialog v-model="ouvert" max-width="32rem" aria-modal="true">
    <v-card :title="titre" role="dialog" :aria-label="titre">
      <v-card-text><slot /></v-card-text>
      <v-card-actions>
        <slot name="actions" />
        <v-btn variant="outlined" @click="ouvert = false">Fermer</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
