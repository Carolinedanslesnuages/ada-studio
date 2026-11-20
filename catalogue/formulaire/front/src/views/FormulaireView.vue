<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import ChampQuestion from '@/components/ChampQuestion.vue'
import BoutonAction from '@/components/ui/BoutonAction.vue'
import { envoyerReponse, type Valeurs } from '@/services/formulaire'
import { useFormulaireStore } from '@/stores/formulaire'

const magasin = useFormulaireStore()
const { formulaire, erreur: erreurChargement } = storeToRefs(magasin)

const valeurs = ref<Valeurs>({})
const erreurs = ref<Record<string, string>>({})
const envoiEnCours = ref(false)
const confirmation = ref<string | null>(null)
const erreurEnvoi = ref<string | null>(null)
const resumeErreurs = useTemplateRef<HTMLElement>('resume-erreurs')

onMounted(() => magasin.charger())

async function envoyer(): Promise<void> {
  if (!formulaire.value || envoiEnCours.value) return
  envoiEnCours.value = true
  confirmation.value = null
  erreurEnvoi.value = null
  try {
    const resultat = await envoyerReponse(valeurs.value)
    if (resultat.ok) {
      erreurs.value = {}
      valeurs.value = {}
      confirmation.value = formulaire.value.messageConfirmation
    } else {
      erreurs.value = resultat.erreurs
      // Le résumé des erreurs reçoit le focus : il est lu, et chaque lien mène au champ concerné.
      await nextTick()
      resumeErreurs.value?.focus()
    }
  } catch {
    erreurEnvoi.value = 'Votre réponse n’a pas pu être envoyée. Réessayez dans quelques instants.'
  } finally {
    envoiEnCours.value = false
  }
}

const libelleDe = (identifiant: string) =>
  formulaire.value?.questions.find((question) => question.id === identifiant)?.libelle ?? identifiant
</script>

<template>
  <div v-if="erreurChargement" class="alerte alerte--erreur" role="alert">
    <p class="alerte__titre">Formulaire indisponible</p>
    <p>{{ erreurChargement }}</p>
  </div>
  <template v-else-if="formulaire">
    <h1>{{ formulaire.titre }}</h1>
    <p>{{ formulaire.introduction }}</p>
    <p class="alerte">Prototype : n’indiquez aucune donnée personnelle réelle.</p>

    <div role="status">
      <div v-if="confirmation" class="alerte alerte--succes">
        <p class="alerte__titre">Réponse envoyée</p>
        <p>{{ confirmation }}</p>
      </div>
    </div>
    <div v-if="erreurEnvoi" class="alerte alerte--erreur" role="alert">
      <p class="alerte__titre">Envoi impossible</p>
      <p>{{ erreurEnvoi }}</p>
    </div>

    <div v-if="Object.keys(erreurs).length > 0" ref="resume-erreurs" tabindex="-1" class="alerte alerte--erreur">
      <h2 class="alerte__titre">Le formulaire contient {{ Object.keys(erreurs).length }} erreur(s)</h2>
      <ul>
        <li v-for="(message, identifiant) in erreurs" :key="identifiant">
          <a :href="`#question-${identifiant}`">{{ libelleDe(String(identifiant)) }} : {{ message }}</a>
        </li>
      </ul>
    </div>

    <form novalidate @submit.prevent="envoyer">
      <p class="aide">Les champs marqués « (obligatoire) » doivent être remplis.</p>
      <div v-for="question in formulaire.questions" :key="question.id" class="question">
        <ChampQuestion v-model="valeurs[question.id]" :question="question" :erreur="erreurs[question.id]" />
      </div>
      <BoutonAction type="submit" :label="envoiEnCours ? 'Envoi en cours…' : 'Envoyer ma réponse'" :chargement="envoiEnCours" />
    </form>
  </template>
  <p v-else role="status">Chargement du formulaire…</p>
</template>

<style scoped>
.question {
  margin-bottom: 1.5rem;
}
</style>
