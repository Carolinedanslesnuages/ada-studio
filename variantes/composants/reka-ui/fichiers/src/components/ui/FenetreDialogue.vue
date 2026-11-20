<script setup lang="ts">
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

/** Fenêtre de dialogue modale (Reka UI) : focus piégé dans la fenêtre, Échap la ferme, focus rendu ensuite. */
defineProps<{ titre: string }>()
const ouvert = defineModel<boolean>('ouvert', { default: false })
</script>

<template>
  <DialogRoot v-model:open="ouvert">
    <DialogPortal>
      <DialogOverlay class="voile" />
      <DialogContent class="fenetre" :aria-describedby="undefined">
        <DialogTitle class="fenetre__titre">{{ titre }}</DialogTitle>
        <slot />
        <div class="fenetre__actions">
          <slot name="actions" />
          <DialogClose class="fenetre__fermer">Fermer</DialogClose>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.voile {
  position: fixed;
  inset: 0;
  background: rgb(31 35 40 / 50%);
}

.fenetre {
  position: fixed;
  top: 50%;
  left: 50%;
  width: min(32rem, calc(100% - 2rem));
  padding: 1.5rem;
  transform: translate(-50%, -50%);
  border-radius: var(--app-rayon);
  background: var(--app-fond);
  box-shadow: var(--app-ombre);
}

.fenetre__titre {
  margin-top: 0;
  font-size: 1.25rem;
}

.fenetre__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.fenetre__fermer {
  padding: 0.5rem 1rem;
  border: 1px solid var(--app-bordure-champ);
  border-radius: var(--app-rayon);
  background: var(--app-fond);
  color: var(--app-texte);
  font: inherit;
  cursor: pointer;
}
</style>
