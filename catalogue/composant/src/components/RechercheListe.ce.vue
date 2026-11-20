<script setup lang="ts">
import { computed, ref } from 'vue'
import { annonceResultats, lireElements, rechercher } from '@/lib/recherche'

/**
 * Le composant à intégrer. Réglages par attributs HTML (texte) ; il prévient la page hôte par
 * un événement « choix » (detail : l'élément choisi). Styles isolés (Shadow DOM), couleurs
 * réglables par la page hôte avec les variables CSS --composant-*.
 */
const props = withDefaults(defineProps<{ titre?: string; elements?: string; libelle?: string }>(), {
  titre: '__NOM_PROJET__',
  elements: '',
  libelle: 'Rechercher',
})
const emit = defineEmits<{ choix: [element: string] }>()

const recherche = ref('')
const choisi = ref<string | null>(null)
const tous = computed(() => lireElements(props.elements))
const resultats = computed(() => rechercher(tous.value, recherche.value))
const identifiant = `recherche-${Math.random().toString(36).slice(2, 8)}`

function choisir(element: string): void {
  choisi.value = element
  emit('choix', element)
}
</script>

<template>
  <section class="composant" :aria-labelledby="`${identifiant}-titre`">
    <h2 :id="`${identifiant}-titre`" class="composant__titre">{{ titre }}</h2>
    <label :for="identifiant" class="composant__libelle">{{ libelle }}</label>
    <input :id="identifiant" v-model="recherche" class="composant__champ" type="search" autocomplete="off" />
    <p class="composant__annonce" role="status">{{ annonceResultats(resultats.length) }}</p>
    <ul v-if="resultats.length" class="composant__liste">
      <li v-for="element in resultats" :key="element">
        <button type="button" class="composant__choix" :aria-pressed="element === choisi ? 'true' : 'false'" @click="choisir(element)">
          {{ element }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style>
/* Styles isolés dans le Shadow DOM : ils n'atteignent pas la page hôte, et inversement. */
:host {
  --composant-texte: #1e1e1e;
  --composant-fond: #ffffff;
  --composant-accent: #0f766e;
  --composant-accent-texte: #ffffff;
  --composant-bordure: #666666;
  display: block;
  /* La police est héritée volontairement : le composant s'accorde au site qui l'accueille. */
  font-family: inherit;
}
.composant {
  /* Couleur fixée ici (et non sur :host) : un « color: … !important » de la page hôte s'hérite sinon. */
  color: var(--composant-texte);
  background: var(--composant-fond);
  border: 1px solid var(--composant-bordure);
  border-radius: 0.25rem;
  padding: 1rem;
}
.composant__titre {
  font-size: 1.25rem;
  margin: 0 0 0.75rem;
}
.composant__libelle {
  display: block;
  margin-bottom: 0.25rem;
}
.composant__champ {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  padding: 0.5rem;
  border: 1px solid var(--composant-bordure);
  border-radius: 0.25rem;
}
.composant__annonce {
  margin: 0.5rem 0;
  font-size: 0.875rem;
}
.composant__liste {
  list-style: none;
  margin: 0;
  padding: 0;
}
.composant__choix {
  width: 100%;
  text-align: left;
  font: inherit;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  background: transparent;
  color: var(--composant-texte);
  border: 1px solid var(--composant-bordure);
  border-radius: 0.25rem;
  cursor: pointer;
}
.composant__choix[aria-pressed='true'] {
  background: var(--composant-accent);
  color: var(--composant-accent-texte);
  border-color: var(--composant-accent);
  font-weight: 700;
}
.composant__champ:focus-visible,
.composant__choix:focus-visible {
  outline: 3px solid var(--composant-accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
