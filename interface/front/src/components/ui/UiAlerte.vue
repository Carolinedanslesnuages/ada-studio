<script setup lang="ts">
/** Message d'information, de réussite, d'avertissement ou d'erreur. */
withDefaults(
  defineProps<{ type?: 'info' | 'success' | 'warning' | 'error'; title?: string; description?: string; small?: boolean }>(),
  { type: 'info', title: undefined, description: undefined },
)
const icones = { info: 'icone-information-line', success: 'icone-checkbox-circle-line', warning: 'icone-error-warning-line', error: 'icone-close-circle-line' }
const couleurs = {
  info: 'bg-primaire-50 border-primaire-200 [&_.alerte__icone]:text-primaire-700',
  success: 'bg-green-50 border-green-200 [&_.alerte__icone]:text-green-700',
  warning: 'bg-amber-50 border-amber-200 [&_.alerte__icone]:text-amber-700',
  error: 'bg-red-50 border-red-200 [&_.alerte__icone]:text-red-700',
}
</script>

<template>
  <div
    :class="['alerte', `alerte--${type}`, couleurs[type], small ? 'px-3 py-2 text-sm' : 'p-4', 'mb-4 flex items-start gap-3 rounded-lg border border-solid']"
    :role="type === 'error' ? 'alert' : undefined"
  >
    <span :class="['icone alerte__icone mt-0.5 text-xl', icones[type]]" aria-hidden="true" />
    <div class="[&>:last-child]:mb-0">
      <p v-if="title" class="alerte__titre mb-1 font-bold">{{ title }}</p>
      <p v-if="description" class="alerte__texte mb-0">{{ description }}</p>
      <slot />
    </div>
  </div>
</template>
