<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api } from '@/services/api'

interface ElementVersion {
  texte: string
  demande: number | null
}

interface Versions {
  actuelle: { version: string; url: string; le: string | null } | null
  proposee: {
    version: string | null
    numeroPr: number
    url: string
    nouveautes: ElementVersion[]
    corrections: ElementVersion[]
    autres: ElementVersion[]
    publiable: boolean
    raison: string | null
  } | null
}

const props = defineProps<{ projet: string }>()

const versions = ref<Versions | null>(null)
const ouvert = ref(false)
const publication = ref(false)
const message = ref<string | null>(null)
const erreur = ref<string | null>(null)

const chemin = () => `/projets/${encodeURIComponent(props.projet)}/versions`

async function charger(): Promise<void> {
  erreur.value = null
  try {
    versions.value = await api.lire<Versions>(chemin())
  } catch (e) {
    erreur.value = (e as Error).message
  }
}

/** Relit les versions sans effacer le message d'erreur affiché. */
async function relire(): Promise<void> {
  try {
    versions.value = await api.lire<Versions>(chemin())
  } catch {
    /* toujours indisponible : l'erreur affichée suffit */
  }
}

async function publier(): Promise<void> {
  const version = versions.value?.proposee?.version
  publication.value = true
  erreur.value = null
  try {
    versions.value = await api.envoyer<Versions>(`${chemin()}/publier`, {})
    message.value = `La version ${version} est publiée. Sa page sur GitHub apparaîtra dans une minute.`
    ouvert.value = false
  } catch (e) {
    erreur.value = (e as Error).message
    // La publication a pu aboutir malgré l'erreur (réponse perdue) : on relit l'état réel.
    setTimeout(() => void relire(), 4000)
  } finally {
    publication.value = false
  }
}

onMounted(charger)
watch(
  () => props.projet,
  () => {
    message.value = null
    ouvert.value = false
    void charger()
  },
)
defineExpose({ charger })
</script>

<template>
  <section class="versions mb-2w" aria-labelledby="titre-versions">
    <h2 id="titre-versions" class="titre-6 mb-1w">Versions</h2>
    <UiAlerte v-if="erreur" type="error" small :description="erreur" />
    <p v-else-if="!versions" class="texte-sm mb-0">Lecture des versions…</p>
    <template v-else>
      <p class="texte-sm mb-1w">
        Version actuelle :
        <a v-if="versions.actuelle" :href="versions.actuelle.url" target="_blank" rel="noopener">
          {{ versions.actuelle.version }}<span class="visuellement-cache"> (nouvelle fenêtre)</span>
        </a>
        <span v-else>aucune version publiée</span>
      </p>
      <p v-if="message" class="texte-sm mb-1w" role="status">{{ message }}</p>

      <div v-if="versions.proposee">
        <UiBouton
          size="sm"
          secondary
          :label="ouvert ? 'Masquer le récapitulatif' : `Nouvelle version prête : ${versions.proposee.version}`"
          @click="ouvert = !ouvert"
        />
        <div v-if="ouvert" class="mt-2w">
          <h3 class="texte-md mb-1w">Ce que contient la version {{ versions.proposee.version }}</h3>
          <template v-if="versions.proposee.nouveautes.length">
            <p class="texte-sm mb-1v"><strong>Nouveautés</strong></p>
            <ul class="texte-sm">
              <li v-for="element in versions.proposee.nouveautes" :key="element.texte">
                {{ element.texte }}<span v-if="element.demande"> (story #{{ element.demande }})</span>
              </li>
            </ul>
          </template>
          <template v-if="versions.proposee.corrections.length">
            <p class="texte-sm mb-1v"><strong>Corrections</strong></p>
            <ul class="texte-sm">
              <li v-for="element in versions.proposee.corrections" :key="element.texte">
                {{ element.texte }}<span v-if="element.demande"> (problème #{{ element.demande }})</span>
              </li>
            </ul>
          </template>
          <p class="texte-xs">
            Publier crée une version figée du projet, avec son journal des changements, que vous
            pouvez montrer ou retrouver plus tard. Rien n’est mis en production.
          </p>
          <UiAlerte v-if="!versions.proposee.publiable && versions.proposee.raison" type="warning" small :description="versions.proposee.raison" class="mb-1w" />
          <UiBouton
            :label="publication ? 'Publication…' : `Publier la version ${versions.proposee.version}`"
            :disabled="!versions.proposee.publiable || publication"
            @click="publier"
          />
        </div>
      </div>
    </template>
  </section>
</template>
