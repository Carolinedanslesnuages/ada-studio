<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

/**
 * Fenêtre de dialogue modale : titre relié (aria-labelledby), focus placé dans la fenêtre à
 * l'ouverture, Échap la ferme, le focus revient sur l'élément qui l'a ouverte.
 */
defineProps<{ titre: string }>()
const ouvert = defineModel<boolean>('ouvert', { default: false })
const id = useId()
const fenetre = ref<HTMLElement | null>(null)
let origine: HTMLElement | null = null
const fermerSurEchap = (evenement: KeyboardEvent) => {
  if (evenement.key === 'Escape') ouvert.value = false
}

watch(
  ouvert,
  async (estOuvert) => {
    if (estOuvert) {
      document.addEventListener('keydown', fermerSurEchap)
      origine = document.activeElement as HTMLElement | null
      await nextTick()
      fenetre.value?.focus()
    } else {
      document.removeEventListener('keydown', fermerSurEchap)
      origine?.focus()
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => document.removeEventListener('keydown', fermerSurEchap))
</script>

<template>
  <div v-if="ouvert" class="voile">
    <div
      ref="fenetre"
      class="fenetre"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`${id}-titre`"
      tabindex="-1"
    >
      <h2 :id="`${id}-titre`" class="fenetre__titre">{{ titre }}</h2>
      <slot />
      <div class="fenetre__actions">
        <slot name="actions" />
        <button type="button" class="fenetre__fermer" @click="ouvert = false">Fermer</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voile {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(31 35 40 / 50%);
}

.fenetre {
  width: min(32rem, 100%);
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
