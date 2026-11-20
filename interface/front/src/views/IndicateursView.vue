<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/services/api'
import { duree, type Indicateurs } from '@/lib/indicateurs'
import EmpreinteCarbone from '@/components/EmpreinteCarbone.vue'
import type { EmpreinteAda } from '@/lib/empreinte'

const indicateurs = ref<Indicateurs | null>(null)
const empreinte = ref<EmpreinteAda | null>(null)
const erreur = ref<string | null>(null)

onMounted(async () => {
  // L'empreinte se lit sur l'appareil (journal d'ADA) : rapide, et indépendante de GitHub.
  api
    .lire<EmpreinteAda>('/indicateurs/empreinte')
    .then((valeur) => (empreinte.value = valeur))
    .catch(() => (empreinte.value = null))
  try {
    indicateurs.value = await api.lire<Indicateurs>('/indicateurs')
  } catch (e) {
    erreur.value = (e as Error).message
  }
})

/** Les chiffres clés, en tête de page. */
const chiffres = computed(() =>
  indicateurs.value
    ? [
        { titre: 'Projets passés par ADA', valeur: String(indicateurs.value.historique.total) },
        { titre: 'Projets actifs dans ADA', valeur: String(indicateurs.value.projets) },
        { titre: 'Stories livrées', valeur: String(indicateurs.value.storiesLivrees) },
        { titre: 'Temps moyen du lancement à la livraison', valeur: duree(indicateurs.value.dureeMoyenneMinutes) },
      ]
    : [],
)

/** Ce que sont devenus les projets : une barre (décorative) et sa légende en texte. */
const devenir = computed(() => {
  const bilan = indicateurs.value?.historique
  if (!bilan) return []
  return [
    { cle: 'actifs', libelle: 'Actifs dans ADA', nombre: bilan.actifs },
    { cle: 'archives', libelle: 'Archivés', nombre: bilan.archives },
    { cle: 'retires', libelle: 'Retirés d’ADA (reprise annulée, désynchronisés)', nombre: bilan.retires },
    { cle: 'supprimes', libelle: 'Supprimés de GitHub', nombre: bilan.supprimes },
  ].map((etat) => ({ ...etat, part: bilan.total ? (etat.nombre / bilan.total) * 100 : 0 }))
})

const entetes = ['Projet', 'Stories livrées', 'Temps moyen de livraison']
const lignes = computed(() =>
  (indicateurs.value?.parProjet ?? []).map((projet) => [projet.nom, String(projet.storiesLivrees), duree(projet.dureeMoyenneMinutes)]),
)
</script>

<template>
  <div class="conteneur px-0">
    <h1>Indicateurs</h1>
    <p class="texte-intro">Ce qu’ADA a permis de livrer, calculé à partir de GitHub. Mis à jour toutes les 5 minutes au plus.</p>

    <UiAlerte v-if="erreur" type="error" title="Indicateurs indisponibles" :description="erreur" />

    <!-- Pendant le calcul (plusieurs secondes) : la forme de la page, sans contenu. -->
    <div v-else-if="!indicateurs" class="squelette" aria-busy="true">
      <p class="visuellement-cache" role="status">Calcul des indicateurs…</p>
      <div class="grille grille--gutters" aria-hidden="true">
        <div v-for="rang in 4" :key="rang" class="col-12 col-sm-6 col-lg-3">
          <div class="squelette__carte" />
        </div>
      </div>
      <div class="squelette__ligne squelette__ligne--titre mt-5w" aria-hidden="true" />
      <div class="squelette__barre" aria-hidden="true" />
      <div class="squelette__ligne squelette__ligne--titre mt-5w" aria-hidden="true" />
      <div v-for="rang in 3" :key="rang" class="squelette__ligne" aria-hidden="true" />
    </div>

    <template v-else>
      <ul class="grille grille--gutters chiffres">
        <li v-for="chiffre in chiffres" :key="chiffre.titre" class="col-12 col-sm-6 col-lg-3">
          <div class="chiffres__carte">
            <p class="chiffres__valeur">{{ chiffre.valeur }}</p>
            <p class="chiffres__titre">{{ chiffre.titre }}</p>
          </div>
        </li>
      </ul>
      <p class="texte-xs mt-1w">Le temps de livraison ne compte que les stories lancées depuis ADA.</p>

      <h2 class="titre-4 mt-5w">Ce que sont devenus les projets</h2>
      <p class="texte-sm">
        {{ indicateurs.historique.total }} projets passés par ADA :
        {{ indicateurs.historique.crees }} créés avec ADA, {{ indicateurs.historique.repris }} repris (créés ailleurs).
        ADA garde la trace de chaque projet, même archivé ou supprimé depuis.
      </p>
      <div v-if="indicateurs.historique.total" class="devenir" aria-hidden="true">
        <span
          v-for="etat in devenir.filter((element) => element.nombre)"
          :key="etat.cle"
          :class="['devenir__part', `devenir__part--${etat.cle}`]"
          :style="{ width: `${etat.part}%` }"
        />
      </div>
      <ul class="legende mt-2w">
        <li v-for="etat in devenir" :key="etat.cle" class="legende__element">
          <span :class="['legende__pastille', `devenir__part--${etat.cle}`]" aria-hidden="true" />
          <strong class="legende__nombre">{{ etat.nombre }}</strong> {{ etat.libelle }}
        </li>
      </ul>
      <p class="texte-xs">
        Les projets d’avant ce suivi sont repris d’après leur aperçu dans ADA ; leur origine est alors
        comptée comme « créé avec ADA ».
      </p>

      <h2 class="titre-4 mt-5w">Par projet actif</h2>
      <UiTableau v-if="lignes.length" class="tableau-pleine-largeur" title="Indicateurs par projet" no-caption :headers="entetes" :rows="lignes" />
      <p v-else>Aucun projet actif pour l’instant.</p>
    </template>

    <EmpreinteCarbone v-if="empreinte" :empreinte="empreinte" />
  </div>
</template>

<style scoped>
.chiffres {
  list-style: none;
  padding: 0;
  margin: 0;
}
.chiffres__carte {
  height: 100%;
  padding: 1.5rem;
  background: var(--app-fond-primaire);
  border-bottom: 4px solid var(--app-primaire);
}
.chiffres__valeur {
  margin: 0 0 0.25rem;
  font-size: 2.5rem;
  line-height: 1.1;
  font-weight: 700;
  color: var(--app-primaire);
}
.chiffres__titre {
  margin: 0;
  font-size: 0.875rem;
}

/* Barre du devenir des projets : décorative, la légende donne les mêmes informations en texte. */
.devenir {
  display: flex;
  height: 1.5rem;
  border-radius: 0.25rem;
  overflow: hidden;
  background: var(--app-fond-doux);
}
.devenir__part {
  display: block;
  min-width: 0.5rem;
}
.devenir__part--actifs {
  background: var(--app-succes);
}
.devenir__part--archives {
  background: var(--app-gris);
}
.devenir__part--retires {
  background: var(--app-avertissement);
}
.devenir__part--supprimes {
  background: var(--app-erreur);
}
.legende {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 2rem;
}
.legende__element {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.legende__pastille {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border-radius: 0.2rem;
}
.legende__nombre {
  font-size: 1.25rem;
}

/* Le tableau prend toute la largeur. */
.tableau-pleine-largeur,
.tableau-pleine-largeur :deep(.tableau),
.tableau-pleine-largeur :deep(.tableau),
.tableau-pleine-largeur :deep(.tableau),
.tableau-pleine-largeur :deep(table) {
  width: 100%;
}
/* Le tableau s'affiche en bloc (pour le faire défiler) : ses lignes ne s'étirent pas. */
.tableau-pleine-largeur :deep(table) {
  display: table;
}

/* Squelette de chargement. */
.squelette__carte,
.squelette__ligne,
.squelette__barre {
  border-radius: 0.25rem;
  background: var(--app-fond-doux);
  animation: squelette 1.4s ease-in-out infinite;
}
.squelette__carte {
  height: 7.5rem;
}
.squelette__barre {
  height: 1.5rem;
  margin-top: 1rem;
}
.squelette__ligne {
  height: 1rem;
  margin-top: 0.75rem;
  max-width: 40rem;
}
.squelette__ligne--titre {
  height: 1.5rem;
  max-width: 18rem;
}
@keyframes squelette {
  50% {
    opacity: 0.45;
  }
}
@media (prefers-reduced-motion: reduce) {
  .squelette__carte,
  .squelette__ligne,
  .squelette__barre {
    animation: none;
  }
}
</style>
