<script setup lang="ts">
import { provide } from 'vue'

/** Groupe d'accordéons : un seul ouvert à la fois ; v-model = rang de celui ouvert (-1 : aucun). */
const ouvert = defineModel<number>({ default: -1 })
let compteur = 0
const inscrire = () => compteur++
provide('accordeons', { ouvert, inscrire })
</script>

<template>
  <div class="accordeons"><slot /></div>
</template>
