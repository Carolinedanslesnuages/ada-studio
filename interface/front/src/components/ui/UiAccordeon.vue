<script setup lang="ts">
import { computed, inject, ref, useId, type Ref } from 'vue'

/** Section repliable : un bouton (aria-expanded) commande son contenu. */
const props = defineProps<{ title: string; id?: string }>()
const groupe = inject<{ ouvert: Ref<number>; inscrire: () => number } | null>('accordeons', null)
const rang = groupe ? groupe.inscrire() : -1
const local = ref(false)
const ouvert = computed(() => (groupe ? groupe.ouvert.value === rang : local.value))
const identifiant = props.id ?? useId()
function basculer(): void {
  if (groupe) groupe.ouvert.value = ouvert.value ? -1 : rang
  else local.value = !local.value
}
</script>

<template>
  <section class="accordeon border-0 border-b border-solid border-primaire-100">
    <h3 class="accordeon__titre m-0 text-base">
      <button type="button" class="accordeon__bouton flex w-full items-center justify-between gap-4 rounded-md border-0 bg-transparent px-2 py-3 text-left text-base font-semibold text-primaire-700 cursor-pointer hover:bg-primaire-50" :aria-expanded="ouvert" :aria-controls="identifiant" @click="basculer">
        {{ title }}
        <span :class="['icone', ouvert ? 'icone-arrow-up-s-line' : 'icone-arrow-down-s-line']" aria-hidden="true" />
      </button>
    </h3>
    <div v-show="ouvert" :id="identifiant" class="accordeon__contenu px-2 pb-4 pt-1"><slot /></div>
  </section>
</template>
