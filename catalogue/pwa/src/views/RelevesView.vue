<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRelevesStore } from '@/stores/releves'
import BoutonAction from '@/components/ui/BoutonAction.vue'
import ChampSaisie from '@/components/ui/ChampSaisie.vue'

const magasin = useRelevesStore()
const { releves, erreur } = storeToRefs(magasin)
const texte = ref('')
const erreurSaisie = ref('')
const annonce = ref('')

function ajouter(): void {
  if (!texte.value.trim()) {
    erreurSaisie.value = 'Écrivez le relevé avant de l’ajouter'
    return
  }
  magasin.ajouter(texte.value)
  annonce.value = 'Relevé ajouté.'
  texte.value = ''
  erreurSaisie.value = ''
}

function supprimer(id: string): void {
  magasin.supprimer(id)
  annonce.value = 'Relevé supprimé.'
}

const dateLisible = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <h1>__NOM_PROJET__</h1>
  <p>Exemple : des relevés saisis sur le terrain, même sans réseau. Ils restent sur cet appareil.</p>

  <form novalidate class="formulaire" @submit.prevent="ajouter">
    <ChampSaisie v-model="texte" label="Nouveau relevé" :erreur="erreurSaisie || undefined" />
    <BoutonAction type="submit" label="Ajouter" />
  </form>
  <p role="status" class="visuellement-cache">{{ annonce }}</p>
  <div v-if="erreur" class="alerte alerte--erreur" role="alert">
    <p>{{ erreur }}</p>
  </div>

  <h2 class="titre-section">Relevés ({{ releves.length }})</h2>
  <p v-if="releves.length === 0">Aucun relevé pour l’instant.</p>
  <ul v-else class="liste-sobre releves">
    <li v-for="releve in releves" :key="releve.id" class="releve">
      <p>{{ releve.texte }}</p>
      <p class="texte-petit">Saisi le {{ dateLisible(releve.saisiLe) }}</p>
      <button type="button" class="releve__supprimer" :aria-label="`Supprimer le relevé « ${releve.texte} »`" @click="supprimer(releve.id)">
        Supprimer
      </button>
    </li>
  </ul>

  <details class="depliable installer">
    <summary>Installer l’application sur mon téléphone</summary>
    <ul>
      <li><strong>Android (Chrome, Edge)</strong> : menu ⋮, puis « Installer l’application ».</li>
      <li><strong>iPhone (Safari)</strong> : bouton Partager, puis « Sur l’écran d’accueil ».</li>
      <li><strong>Ordinateur (Chrome, Edge)</strong> : icône d’installation dans la barre d’adresse.</li>
    </ul>
    <p>Une fois installée, elle s’ouvre comme une application et fonctionne sans réseau.</p>
  </details>
</template>

<style scoped>
.formulaire {
  margin-bottom: 2rem;
}

.titre-section {
  font-size: 1.25rem;
}

.releve {
  margin-bottom: 1rem;
}

.releve p {
  margin: 0 0 0.25rem;
}

.releve__supprimer {
  padding: 0.25rem 0.75rem;
  border: 0;
  background: none;
  color: var(--app-primaire);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.installer {
  margin-top: 2rem;
}
</style>
