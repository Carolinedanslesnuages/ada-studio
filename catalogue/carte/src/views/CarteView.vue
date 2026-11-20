<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import CarteLieux from '@/components/CarteLieux.vue'
import ListeLieux from '@/components/ListeLieux.vue'
import { CATEGORIES } from '@/lib/lieux'
import { useLieuxStore } from '@/stores/lieux'

const magasin = useLieuxStore()
const { categoriesChoisies, lieuxAffiches, lieuChoisi } = storeToRefs(magasin)
const options = CATEGORIES.map((categorie) => ({ id: `categorie-${categorie.id}`, label: categorie.libelle, value: categorie.id }))
const annonce = computed(() => `${lieuxAffiches.value.length} lieu${lieuxAffiches.value.length > 1 ? 'x' : ''} affiché${lieuxAffiches.value.length > 1 ? 's' : ''}`)
</script>

<template>
  <h1>__NOM_PROJET__</h1>
  <p>Les lieux sont présentés sur une carte et dans une liste, qui donnent les mêmes informations.</p>

  <fieldset class="groupe-choix groupe-choix--en-ligne">
    <legend>Afficher</legend>
    <div v-for="option in options" :key="option.id" class="choix">
      <input :id="option.id" v-model="categoriesChoisies" type="checkbox" name="categories" :value="option.value" />
      <label :for="option.id">{{ option.label }}</label>
    </div>
  </fieldset>
  <p class="annonce" role="status">{{ annonce }}</p>

  <div class="disposition">
    <div class="disposition__carte">
      <CarteLieux :lieux="lieuxAffiches" :lieu-choisi="lieuChoisi" @choisir="magasin.choisir" />
    </div>
    <section class="disposition__liste" aria-labelledby="titre-liste">
      <h2 id="titre-liste" class="titre-liste">Liste des lieux</h2>
      <p v-if="lieuxAffiches.length === 0">Aucun lieu pour ces filtres : cochez au moins une catégorie.</p>
      <ListeLieux v-else :lieux="lieuxAffiches" :lieu-choisi="lieuChoisi" @choisir="magasin.choisir" />
    </section>
  </div>
</template>

<style scoped>
.annonce {
  font-weight: 700;
}

.disposition {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 62em) {
  .disposition {
    grid-template-columns: 2fr 1fr;
  }
}

.titre-liste {
  margin-top: 0;
  font-size: 1.25rem;
}
</style>
