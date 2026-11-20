import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import donnees from '@/donnees/quiz.json'
import { calculerScore, estJuste, lireQuiz } from '@/lib/quiz'

export type Etape = 'accueil' | 'question' | 'resultat'

/** Le parcours du quiz : étape, question en cours, réponses. Rien n'est enregistré (aucun serveur). */
export const useQuizStore = defineStore('quiz', () => {
  const quiz = lireQuiz(donnees)
  const etape = ref<Etape>('accueil')
  const rang = ref(0)
  const reponses = ref<Record<string, string[]>>({})
  const corrigee = ref(false)

  const question = computed(() => quiz.questions[rang.value]!)
  const derniere = computed(() => rang.value === quiz.questions.length - 1)
  const juste = computed(() => estJuste(question.value, reponses.value[question.value.id] ?? []))
  const score = computed(() => calculerScore(quiz, reponses.value))

  function commencer(): void {
    etape.value = 'question'
    rang.value = 0
    reponses.value = {}
    corrigee.value = false
  }

  function repondre(choix: string[]): void {
    if (!corrigee.value) reponses.value = { ...reponses.value, [question.value.id]: choix }
  }

  function corriger(): void {
    corrigee.value = true
  }

  function suivante(): void {
    if (derniere.value) etape.value = 'resultat'
    else rang.value++
    corrigee.value = false
  }

  return { quiz, etape, rang, reponses, corrigee, question, derniere, juste, score, commencer, repondre, corriger, suivante }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useQuizStore, import.meta.hot))
