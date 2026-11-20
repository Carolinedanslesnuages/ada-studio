<script setup lang="ts">
/** Étiquette d'état (« Livrée », « À vérifier »…), en forme de pilule. */
withDefaults(defineProps<{ label: string; type?: 'success' | 'info' | 'warning' | 'error' | 'new'; small?: boolean; noIcon?: boolean }>(), { type: 'info' })
</script>

<template>
  <span :class="['badge', `badge--${type}`, { 'badge--petit': small }]">{{ label }}</span>
</template>
