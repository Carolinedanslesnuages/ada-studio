<script setup lang="ts">
import { computed } from 'vue'
import type { Serie } from '@/services/indicateurs'
import { nombre, periode } from '@/lib/format'

/**
 * Graphique en courbes dessiné en SVG (sans bibliothèque) et son alternative accessible : un
 * résumé en texte et le tableau des données (RGAA 1.6 : alternative à une image complexe).
 * Chaque courbe a sa couleur ET son motif de trait : l'information ne passe pas par la couleur seule.
 */
const props = defineProps<{ serie: Serie; identifiant: string }>()

const LARGEUR = 640
const HAUTEUR = 240
const MARGE = 32
const TRACES = [
  { couleur: '#0f766e', tirets: '' },
  { couleur: '#7c3aed', tirets: '8 4' },
  { couleur: '#b45309', tirets: '2 4' },
  { couleur: '#1f2328', tirets: '12 4 2 4' },
]

const maximum = computed(() => {
  const valeurs = props.serie.courbes.flatMap((courbe) => courbe.valeurs.filter((valeur): valeur is number => valeur !== null))
  return Math.max(1, ...valeurs)
})
const abscisse = (rang: number) =>
  MARGE + (props.serie.periodes.length < 2 ? 0 : (rang * (LARGEUR - 2 * MARGE)) / (props.serie.periodes.length - 1))
const ordonnee = (valeur: number) => HAUTEUR - MARGE - (valeur / maximum.value) * (HAUTEUR - 2 * MARGE)
const courbes = computed(() =>
  props.serie.courbes.map((courbe, rang) => ({
    nom: courbe.nom,
    trace: TRACES[rang % TRACES.length]!,
    points: courbe.valeurs
      .map((valeur, position) => (valeur === null ? null : `${abscisse(position)},${ordonnee(valeur)}`))
      .filter(Boolean)
      .join(' '),
  })),
)
const resume = computed(() =>
  props.serie.courbes
    .map((courbe) => {
      const connues = courbe.valeurs.filter((valeur): valeur is number => valeur !== null)
      if (!connues.length) return `${courbe.nom} : aucune mesure`
      return `${courbe.nom} : de ${nombre(connues[0]!)} à ${nombre(connues[connues.length - 1]!)} ${props.serie.unite}, au plus haut ${nombre(Math.max(...connues))}`
    })
    .join(' ; '),
)
</script>

<template>
  <figure class="graphique" :aria-labelledby="`${identifiant}-titre`">
    <h2 :id="`${identifiant}-titre`" class="graphique__titre">{{ serie.titre }}</h2>
    <svg :viewBox="`0 0 ${LARGEUR} ${HAUTEUR}`" class="graphique__dessin" aria-hidden="true" focusable="false">
      <line :x1="MARGE" :y1="HAUTEUR - MARGE" :x2="LARGEUR - MARGE" :y2="HAUTEUR - MARGE" class="graphique__axe" />
      <polyline
        v-for="courbe in courbes"
        :key="courbe.nom"
        :points="courbe.points"
        fill="none"
        :stroke="courbe.trace.couleur"
        :stroke-dasharray="courbe.trace.tirets || undefined"
        stroke-width="3"
      />
    </svg>
    <ul class="graphique__legende">
      <li v-for="courbe in courbes" :key="courbe.nom">
        <svg width="32" height="8" aria-hidden="true" focusable="false">
          <line x1="0" y1="4" x2="32" y2="4" :stroke="courbe.trace.couleur" :stroke-dasharray="courbe.trace.tirets || undefined" stroke-width="3" />
        </svg>
        {{ courbe.nom }}
      </li>
    </ul>
    <figcaption class="graphique__resume">{{ resume }}.</figcaption>
    <details class="graphique__donnees">
      <summary>Voir les données en tableau</summary>
      <table>
        <caption>{{ serie.titre }} : données</caption>
        <thead>
          <tr>
            <th scope="col">Période</th>
            <th v-for="courbe in serie.courbes" :key="courbe.nom" scope="col">{{ courbe.nom }} ({{ serie.unite }})</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(mois, rang) in serie.periodes" :key="mois">
            <th scope="row">{{ periode(mois) }}</th>
            <td v-for="courbe in serie.courbes" :key="courbe.nom">{{ nombre(courbe.valeurs[rang] ?? null) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<style scoped>
.graphique {
  margin: 0 0 2rem;
}

.graphique__titre {
  font-size: 1.375rem;
}

.graphique__dessin {
  display: block;
  width: 100%;
  height: auto;
}

.graphique__axe {
  stroke: var(--app-bordure-champ);
}

.graphique__legende {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0;
  list-style: none;
}

.graphique__legende li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.graphique__resume {
  font-size: 0.875rem;
}

.graphique__donnees {
  margin-top: 1rem;
}

.graphique__donnees summary {
  cursor: pointer;
  color: var(--app-primaire);
  font-weight: 600;
}

table {
  width: 100%;
  margin-top: 0.5rem;
  border-collapse: collapse;
}

caption {
  text-align: left;
  font-weight: 700;
}

th,
td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--app-bordure);
  text-align: left;
}
</style>
