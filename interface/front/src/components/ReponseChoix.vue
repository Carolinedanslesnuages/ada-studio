<script setup lang="ts">
import { reactive, ref } from 'vue'
import { composerReponse, type QuestionAChoix } from '@/lib/story'

/** Réponse aux questions à choix de l'assistant : cases à cocher (ou boutons radio) et précision libre. */
const props = defineProps<{ questions: QuestionAChoix[]; actionEnCours?: boolean; descriptionEnvoi?: string }>()

/** ADA numérote les questions : le numéro déjà écrit par l'assistant (« 1. ») n'est pas répété. */
const sansNumero = (question: string) => question.replace(/^\d+\s*[.)]\s*/, '')
const emit = defineEmits<{ repondre: [texte: string] }>()

const reponses = reactive(props.questions.map(() => ({ coches: [] as string[], unique: undefined as string | undefined, precision: '' })))
const erreurs = ref<string[]>([])

const options = (rang: number, question: QuestionAChoix) =>
  question.choix.map((option, position) => ({
    id: `choix-${rang}-${position}`,
    name: `question-${rang}`,
    label: option,
    value: option,
  }))

function envoyer(): void {
  const choisies = reponses.map((reponse, rang) => ({
    coches: props.questions[rang]!.plusieurs ? reponse.coches : reponse.unique ? [reponse.unique] : [],
    precision: reponse.precision,
  }))
  erreurs.value = choisies.map((reponse) =>
    reponse.coches.length || reponse.precision.trim() ? '' : 'Cochez une réponse, ou écrivez une précision',
  )
  if (erreurs.value.some(Boolean)) return
  emit('repondre', composerReponse(props.questions, choisies))
}
</script>

<template>
  <form novalidate class="mt-2w" @submit.prevent="envoyer">
    <UiAlerte type="info" small class="mb-2w" description="ADA attend vos réponses pour continuer. Cochez, et précisez si besoin." />
    <div v-for="(question, rang) in questions" :key="question.question" class="mb-3w">
      <UiChoixMultiple
        v-if="question.plusieurs"
        v-model="reponses[rang]!.coches"
        :legend="`${rang + 1}. ${sansNumero(question.question)} (plusieurs réponses possibles)`"
        :options="options(rang, question)"
        :error-message="erreurs[rang]"
      />
      <UiChoixUnique
        v-else
        v-model="reponses[rang]!.unique"
        :name="`question-${rang}`"
        :legend="`${rang + 1}. ${sansNumero(question.question)}`"
        :options="options(rang, question)"
        :error-message="erreurs[rang]"
      />
      <UiChamp
        v-model="reponses[rang]!.precision"
        :label="`Autre / précision pour la question ${rang + 1} (facultatif)`"
        label-visible
      />
    </div>
    <slot name="avant-envoi" />
    <UiBouton type="submit" label="Envoyer mes réponses" :aria-describedby="descriptionEnvoi" :disabled="actionEnCours" />
  </form>
</template>
