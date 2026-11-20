<script setup lang="ts">
/**
 * Bouton : principal (couleur primaire), secondaire (contour) ou tertiaire (discret), avec icône
 * facultative. En chargement : occupé (aria-busy), inactif, une roue remplace l'icône.
 */
withDefaults(
  defineProps<{
    label: string
    icon?: string
    iconRight?: boolean
    secondary?: boolean
    tertiary?: boolean
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    chargement?: boolean
    /** Accepté pour compatibilité ; le contour reste celui du thème. */
    noOutline?: boolean
  }>(),
  { icon: undefined, size: 'md', type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || chargement"
    :aria-busy="chargement ? 'true' : undefined"
    :class="['bouton', `bouton--${size}`, { 'bouton--secondaire': secondary, 'bouton--tertiaire': tertiary }]"
  >
    <span v-if="chargement" class="bouton__roue" aria-hidden="true" />
    <span v-else-if="icon && !iconRight" :class="['icone', icon]" aria-hidden="true" />
    {{ label }}
    <span v-if="icon && iconRight" :class="['icone', icon]" aria-hidden="true" />
  </button>
</template>

<style scoped>
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
