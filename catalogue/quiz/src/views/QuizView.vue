<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { bonnesReponses, estJuste } from '@/lib/quiz'
import { useQuizStore } from '@/stores/quiz'
import BoutonAction from '@/components/ui/BoutonAction.vue'

const magasin = useQuizStore()
const { etape, rang, question, corrigee, juste, derniere, score, reponses } = storeToRefs(magasin)
/** Le quiz ne change pas pendant le parcours : pas besoin de le rendre réactif. */
const quiz = magasin.quiz

const erreur = ref('')
const titreEtape = useTemplateRef<HTMLElement>('titre-etape')
const correction = useTemplateRef<HTMLElement>('correction')
const etapeQuestion = useTemplateRef<HTMLElement>('etape-question')

const options = computed(() =>
  question.value.choix.map((possibilite) => ({
    id: `choix-${question.value.id}-${possibilite.id}`,
    label: possibilite.texte,
    value: possibilite.id,
    disabled: corrigee.value,
  })),
)
const choixUnique = computed({
  get: () => reponses.value[question.value.id]?.[0],
  set: (valeur: string | undefined) => magasin.repondre(valeur === undefined ? [] : [String(valeur)]),
})
const choixMultiples = computed({
  get: () => reponses.value[question.value.id] ?? [],
  set: (valeurs: string[]) => magasin.repondre(valeurs.map(String)),
})

/** À chaque nouvelle étape ou question, le focus va à son titre (lecteurs d'écran, clavier). */
watch([etape, rang], async () => {
  erreur.value = ''
  await nextTick()
  const titre = etape.value === 'question' ? etapeQuestion.value?.querySelector<HTMLElement>('h2') : titreEtape.value
  titre?.setAttribute('tabindex', '-1')
  titre?.focus()
})

async function valider(): Promise<void> {
  if ((reponses.value[question.value.id] ?? []).length === 0) {
    erreur.value = question.value.type === 'multiple' ? 'Cochez au moins une réponse' : 'Choisissez une réponse'
    return
  }
  erreur.value = ''
  magasin.corriger()
  await nextTick()
  correction.value?.focus()
}
</script>

<template>
  <h1>{{ quiz.titre }}</h1>

  <section v-if="etape === 'accueil'" aria-labelledby="titre-accueil">
    <h2 id="titre-accueil" ref="titre-etape" tabindex="-1" class="titre-etape">Avant de commencer</h2>
    <p>{{ quiz.introduction }}</p>
    <p>
      {{ quiz.questions.length }} questions. Il faut {{ quiz.seuilReussite }} % de bonnes réponses pour
      réussir. Rien n’est enregistré.
    </p>
    <BoutonAction label="Commencer" @click="magasin.commencer()" />
  </section>

  <section v-else-if="etape === 'question'" ref="etape-question">
    <!-- Le titre dit où l'on en est : « Question 2, Étape 2 sur 3 » ; la barre le montre (décorative). -->
    <h2 class="titre-etape">
      Question {{ rang + 1 }}
      <span class="etapes__position">Étape {{ rang + 1 }} sur {{ quiz.questions.length }}</span>
    </h2>
    <div class="etapes__barre" aria-hidden="true">
      <span :style="{ width: `${((rang + 1) / quiz.questions.length) * 100}%` }" />
    </div>
    <form novalidate @submit.prevent="corrigee ? magasin.suivante() : valider()">
      <fieldset class="groupe-choix" :aria-describedby="erreur ? `erreur-${question.id}` : undefined">
        <legend>{{ question.type === 'unique' ? question.enonce : `${question.enonce} (plusieurs réponses possibles)` }}</legend>
        <div v-for="option in options" :key="option.id" class="choix">
          <input
            v-if="question.type === 'unique'"
            :id="option.id"
            v-model="choixUnique"
            type="radio"
            :name="`question-${question.id}`"
            :value="option.value"
            :disabled="option.disabled"
            required
          />
          <input
            v-else
            :id="option.id"
            v-model="choixMultiples"
            type="checkbox"
            :name="`question-${question.id}`"
            :value="option.value"
            :disabled="option.disabled"
          />
          <label :for="option.id">{{ option.label }}</label>
        </div>
        <p v-if="erreur" :id="`erreur-${question.id}`" class="erreur-champ">{{ erreur }}</p>
      </fieldset>

      <div v-if="corrigee" ref="correction" tabindex="-1" :class="['alerte', juste ? 'alerte--succes' : 'alerte--erreur']">
        <p class="alerte__titre">{{ juste ? 'Bonne réponse' : 'Ce n’est pas la bonne réponse' }}</p>
        <p>{{ juste ? '' : `La bonne réponse : ${bonnesReponses(question).join(', ')}. ` }}{{ question.explication }}</p>
      </div>

      <BoutonAction
        type="submit"
        :label="!corrigee ? 'Valider ma réponse' : derniere ? 'Voir mon résultat' : 'Question suivante'"
      />
    </form>
  </section>

  <section v-else aria-labelledby="titre-resultat">
    <h2 id="titre-resultat" ref="titre-etape" tabindex="-1" class="titre-etape">Votre résultat</h2>
    <div :class="['alerte', score.reussi ? 'alerte--succes' : '']">
      <p class="alerte__titre">
        {{ score.justes }} bonne{{ score.justes > 1 ? 's' : '' }} réponse{{ score.justes > 1 ? 's' : '' }} sur {{ score.total }} ({{ score.pourcentage }} %)
      </p>
      <p>{{ score.reussi ? 'Réussi : bravo !' : `Pas encore : il faut ${quiz.seuilReussite} % de bonnes réponses. Vous pouvez recommencer.` }}</p>
    </div>
    <h3 class="recapitulatif">Récapitulatif</h3>
    <ol>
      <li v-for="questionPosee in quiz.questions" :key="questionPosee.id" class="recapitulatif__question">
        <p>
          {{ questionPosee.enonce }}
          <strong>{{ estJuste(questionPosee, reponses[questionPosee.id] ?? []) ? '— Juste' : '— À revoir' }}</strong>
        </p>
        <p class="texte-petit">Bonne réponse : {{ bonnesReponses(questionPosee).join(', ') }}. {{ questionPosee.explication }}</p>
      </li>
    </ol>
    <BoutonAction label="Recommencer" variante="secondaire" @click="magasin.commencer()" />
  </section>
</template>

<style scoped>
.titre-etape {
  font-size: 1.5rem;
}

.etapes__position {
  display: block;
  margin-top: 0.25rem;
  color: var(--app-texte-doux);
  font-size: 0.875rem;
  font-weight: 400;
}

.etapes__barre {
  height: 0.5rem;
  margin-bottom: 1.5rem;
  border-radius: var(--app-rayon);
  background: var(--app-fond-doux);
}

.etapes__barre span {
  display: block;
  height: 100%;
  border-radius: var(--app-rayon);
  background: var(--app-primaire);
}

.recapitulatif {
  margin-top: 1.5rem;
  font-size: 1.125rem;
}

.recapitulatif__question p {
  margin: 0 0 0.25rem;
}

.recapitulatif__question {
  margin-bottom: 1rem;
}
</style>
