<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ResumeStory } from '@/lib/story'

/** Stories livrées, repliées par défaut : les 10 dernières, et le lien vers tout l'historique. */
const props = defineProps<{ stories: ResumeStory[]; urlDepot: string; numeroCourant?: number | null }>()
const emit = defineEmits<{ ouvrir: [numero: number] }>()

const NOMBRE_LIVREES_AFFICHEES = 10

const accordeonOuvert = ref(-1)
const dernieres = computed(() => props.stories.slice(0, NOMBRE_LIVREES_AFFICHEES))
const lienHistorique = computed(() => `${props.urlDepot}/issues?q=${encodeURIComponent('is:issue is:closed')}`)
const titre = computed(() => `Déjà livrées (${props.stories.length})`)
</script>

<template>
  <UiAccordeons v-model="accordeonOuvert" class="mt-3w">
    <UiAccordeon id="stories-livrees" :title="titre">
      <p v-if="stories.length > NOMBRE_LIVREES_AFFICHEES" class="texte-sm">
        Les {{ NOMBRE_LIVREES_AFFICHEES }} dernières livrées.
      </p>
      <ul class="liste-stories" aria-label="Stories déjà livrées">
        <li v-for="story in dernieres" :key="story.numero">
          <button
            type="button"
            :aria-current="story.numero === numeroCourant ? 'true' : undefined"
            @click="emit('ouvrir', story.numero)"
          >
            <span>
              <span class="texte-xs mb-0">#{{ story.numero }}</span>
              <span v-if="story.type === 'bug'" class="texte-xs mb-0"> Problème :</span>
              <span v-else-if="story.type === 'libre'" class="texte-xs mb-0"> Mode libre :</span>
              {{ story.titre }}
            </span>
          </button>
        </li>
      </ul>
      <a class="lien lien--sm" :href="lienHistorique" target="_blank" rel="noopener"><span class="icone icone-external-link-line" aria-hidden="true" />
        Voir tout sur GitHub<span class="visuellement-cache"> (nouvelle fenêtre)</span>
      </a>
    </UiAccordeon>
  </UiAccordeons>
</template>
