<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DetailStory } from '@/lib/story'
import { useStoriesStore } from '@/stores/stories'

/**
 * Demande bloquée (« Besoin d'un développeur ») : le PO choisit un développeur et la lui assigne
 * sur GitHub. ADA ne le prévient pas : il l'a été par ailleurs.
 */
const props = defineProps<{ projet: string; story: DetailStory }>()
const stories = useStoriesStore()

const choix = ref('')
const choixEnCours = ref(false)
const action = ref(false)
const assigne = computed(() => props.story.assignes[0] ?? null)
const bloquee = computed(() => props.story.statut === 'besoin-dev')
const options = computed(() => (stories.developpeurs ?? []).map((personne) => ({ value: personne.login, text: personne.login })))

async function ouvrirChoix(): Promise<void> {
  choixEnCours.value = true
  choix.value = assigne.value?.login ?? ''
  if (stories.developpeurs === null) await stories.chargerDeveloppeurs(props.projet)
}

async function agir(login: string | null): Promise<void> {
  action.value = true
  await stories.assigner(props.projet, props.story.numero, login)
  action.value = false
  if (!stories.erreurAction) choixEnCours.value = false
}
</script>

<template>
  <section v-if="bloquee || assigne" class="mb-3w" aria-labelledby="titre-assignation">
    <h3 id="titre-assignation" class="titre-6 mb-1w">Développeur</h3>
    <p v-if="assigne" class="mb-1w" role="status">
      Assignée à <strong>{{ assigne.login }}</strong> sur GitHub.
    </p>
    <p v-else class="texte-sm mb-1w">
      Prévenez un développeur, puis assignez-lui cette demande : elle apparaîtra dans son GitHub.
    </p>

    <form v-if="choixEnCours" novalidate @submit.prevent="choix && agir(choix)">
      <UiListe
        v-model="choix"
        label="Développeur à assigner"
        default-unselected-text="Choisir un développeur"
        :options="options"
        hint="Seules les personnes qui ont accès au projet sur GitHub sont proposées."
      />
      <p v-if="stories.developpeurs?.length === 0" class="texte-sm">
        Personne d’autre n’a accès au projet : demandez à l’administrateur d’ajouter les développeurs.
      </p>
      <ul class="groupe-boutons groupe-boutons--sm">
        <li><UiBouton type="submit" size="sm" label="Assigner" :disabled="!choix || action" /></li>
        <li><UiBouton type="button" size="sm" tertiary label="Annuler" @click="choixEnCours = false" /></li>
      </ul>
    </form>
    <ul v-else class="groupe-boutons groupe-boutons--sm">
      <li v-if="bloquee">
        <UiBouton size="sm" secondary icon="icone-user-add-line" :label="assigne ? 'Changer de développeur' : 'Assigner un développeur'" :disabled="action" @click="ouvrirChoix" />
      </li>
      <li v-if="assigne">
        <UiBouton size="sm" tertiary label="Retirer l’assignation" :disabled="action" @click="agir(null)" />
      </li>
    </ul>
  </section>
</template>
