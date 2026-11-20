<script setup lang="ts">
import { computed } from 'vue'
import { lireTexteRiche } from '@/lib/texte-riche'

const props = defineProps<{ texte: string }>()
const blocs = computed(() => lireTexteRiche(props.texte))
</script>

<template>
  <div class="texte-riche">
    <template v-for="(bloc, rang) in blocs" :key="rang">
      <p v-if="bloc.type === 'intertitre'" class="texte-gras mb-1w mt-3w">
        <template v-for="(segment, position) in bloc.segments" :key="position">{{ segment.texte }}</template>
      </p>
      <p v-else-if="bloc.type === 'paragraphe'" class="mb-2w">
        <template v-for="(segment, position) in bloc.segments" :key="position">
          <strong v-if="segment.gras">{{ segment.texte }}</strong>
          <code v-else-if="segment.code">{{ segment.texte }}</code>
          <template v-else>{{ segment.texte }}</template>
        </template>
      </p>
      <component :is="bloc.ordonnee ? 'ol' : 'ul'" v-else class="mb-2w">
        <li v-for="(element, numero) in bloc.elements" :key="numero">
          <template v-for="(segment, position) in element" :key="position">
            <strong v-if="segment.gras">{{ segment.texte }}</strong>
            <code v-else-if="segment.code">{{ segment.texte }}</code>
            <template v-else>{{ segment.texte }}</template>
          </template>
        </li>
      </component>
    </template>
  </div>
</template>
