<script setup lang="ts">
/** Bouton d'action : principal ou secondaire ; en chargement, il est occupé (aria-busy) et inactif. */
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
  <button
    :type="type"
    :class="['bouton', `bouton--${variante}`]"
    :disabled="disabled || chargement"
    :aria-busy="chargement ? 'true' : undefined"
  >
    <span v-if="chargement" class="bouton__roue" aria-hidden="true" />
    {{ label }}
  </button>
</template>

<style scoped>
.bouton {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: 2px solid var(--app-primaire);
  border-radius: var(--app-rayon);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.bouton--principal {
  background: var(--app-primaire);
  color: var(--app-sur-primaire);
}

.bouton--principal:hover:not(:disabled) {
  background: var(--app-primaire-survol);
  border-color: var(--app-primaire-survol);
}

.bouton--secondaire {
  background: var(--app-fond);
  color: var(--app-primaire);
}

.bouton--secondaire:hover:not(:disabled) {
  background: var(--app-fond-doux);
}

.bouton:disabled {
  cursor: not-allowed;
  border-color: var(--app-desactive);
  background: var(--app-fond-doux);
  color: var(--app-texte-doux);
}

.bouton__roue {
  width: 1em;
  height: 1em;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: tourner 0.8s linear infinite;
}

@keyframes tourner {
  to {
    transform: rotate(360deg);
  }
}
</style>
