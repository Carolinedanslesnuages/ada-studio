<script setup lang="ts">
/** La demande elle-même, telle qu'écrite par le PO : story, problème signalé ou demande libre. */
import type { DetailStory } from '@/lib/story'

defineProps<{ story: DetailStory }>()
</script>

<template>
  <section v-if="story.contenu" aria-labelledby="titre-story">
    <h3 id="titre-story" class="titre-6 mb-1w">La story</h3>
    <p class="mb-1w">
      <strong>En tant que</strong> {{ story.contenu.role }},<br />
      <strong>je veux</strong> {{ story.contenu.besoin }},<br />
      <strong>afin de</strong> {{ story.contenu.benefice }}.
    </p>
    <p class="texte-gras mb-1v">Critères d’acceptation</p>
    <ul>
      <li v-for="critere in story.contenu.criteres" :key="critere">{{ critere }}</li>
    </ul>
  </section>
  <section v-else-if="story.contenuBug" aria-labelledby="titre-probleme">
    <h3 id="titre-probleme" class="titre-6 mb-1w">Le problème signalé</h3>
    <dl class="mb-2w">
      <dt><strong>Ce qui se passe</strong></dt>
      <dd>{{ story.contenuBug.constate }}</dd>
      <dt><strong>Ce qui devrait se passer</strong></dt>
      <dd>{{ story.contenuBug.attendu }}</dd>
      <dt><strong>Comment le reproduire</strong></dt>
      <dd class="fil-pre">{{ story.contenuBug.etapes }}</dd>
      <template v-if="story.contenuBug.ecran">
        <dt><strong>Écran concerné</strong></dt>
        <dd>{{ story.contenuBug.ecran }}</dd>
      </template>
    </dl>
  </section>
  <section v-else-if="story.contenuLibre && story.type !== 'conversation'" aria-labelledby="titre-libre">
    <h3 id="titre-libre" class="titre-6 mb-1w">Demande libre (hors story)</h3>
    <p class="texte-xs mb-1w">
      Enregistrée sur GitHub comme demande n° {{ story.numero }} « mode libre ».
    </p>
    <p class="fil-pre">{{ story.contenuLibre }}</p>
  </section>
  <p v-else class="texte-sm">{{ story.texteBrut }}</p>
</template>
