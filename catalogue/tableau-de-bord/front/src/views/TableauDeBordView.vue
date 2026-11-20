<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import GraphiqueAccessible from '@/components/GraphiqueAccessible.vue'
import { evolution, nombre, periode } from '@/lib/format'
import { useIndicateursStore } from '@/stores/indicateurs'

const magasin = useIndicateursStore()
const { tableau, erreur } = storeToRefs(magasin)
onMounted(() => magasin.charger())
</script>

<template>
  <h1>__NOM_PROJET__</h1>
  <p>Les indicateurs sont calculés à partir des mesures enregistrées (données fictives dans l’aperçu).</p>
  <div v-if="erreur" class="alerte" role="alert">
    <p class="alerte__titre">Indicateurs indisponibles</p>
    <p>{{ erreur }}</p>
  </div>
  <p v-else-if="!tableau" role="status">Chargement des indicateurs…</p>
  <template v-else>
    <h2 class="titre-section">Chiffres clés</h2>
    <ul class="chiffres">
      <li v-for="chiffre in tableau.chiffres" :key="chiffre.id" class="chiffres__carte">
        <p class="chiffres__valeur">{{ nombre(chiffre.valeur) }}</p>
        <p class="chiffres__libelle">{{ chiffre.libelle }} — {{ periode(chiffre.periode) }}</p>
        <p class="chiffres__evolution">{{ evolution(chiffre.evolution) }}</p>
      </li>
    </ul>
    <p v-if="tableau.series.length === 0">Aucune mesure enregistrée pour l’instant.</p>
    <div class="series">
      <GraphiqueAccessible v-for="(serie, rang) in tableau.series" :key="serie.titre" :serie="serie" :identifiant="`serie-${rang}`" />
    </div>
  </template>
</template>

<style scoped>
.alerte {
  padding: 1rem;
  border-left: 4px solid var(--app-erreur);
  background: var(--app-fond-erreur);
}

.alerte__titre {
  margin-top: 0;
  font-weight: 700;
}

.titre-section {
  font-size: 1.375rem;
}

.chiffres {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
  padding: 0;
  list-style: none;
}

.chiffres__carte {
  padding: 1rem;
  border-radius: var(--app-rayon);
  background: var(--app-fond-doux);
}

.chiffres__carte p {
  margin: 0 0 0.25rem;
}

.chiffres__valeur {
  font-size: 2rem;
  font-weight: 700;
}

.chiffres__libelle {
  font-weight: 700;
}

.chiffres__evolution {
  font-size: 0.875rem;
}

.series {
  margin-top: 2rem;
}
</style>
