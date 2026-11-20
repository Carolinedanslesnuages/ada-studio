<script setup lang="ts">
import { useId } from 'vue'
import { NModal } from 'naive-ui'

/**
 * Fenêtre de dialogue modale (Naive UI) : focus piégé, Échap la ferme, focus rendu ensuite.
 * Sans le gabarit « card » de Naive UI : son en-tête a role="heading" sans niveau (défaut connu).
 */
defineProps<{ titre: string }>()
const ouvert = defineModel<boolean>('ouvert', { default: false })
const id = useId()
</script>

<template>
  <NModal v-model:show="ouvert">
    <div class="fenetre" role="dialog" aria-modal="true" :aria-labelledby="`${id}-titre`">
      <h2 :id="`${id}-titre`" class="fenetre__titre">{{ titre }}</h2>
      <slot />
      <div class="fenetre__actions">
        <slot name="actions" />
        <button type="button" class="fenetre__fermer" @click="ouvert = false">Fermer</button>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.fenetre {
  width: min(32rem, calc(100% - 2rem));
  padding: 1.5rem;
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
