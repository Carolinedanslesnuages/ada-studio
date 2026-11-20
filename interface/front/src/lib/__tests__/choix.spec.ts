import { describe, it, expect } from 'vitest'
import { composerReponse, lireChoix, MARQUEUR_ASSISTANT, presenterMessage, type QuestionAChoix } from '../story'

const QUESTIONS: QuestionAChoix[] = [
  { question: 'Retour le jour même ?', choix: ['Oui', 'Non'], plusieurs: false },
  { question: 'Quelles colonnes afficher ?', choix: ['Nom', 'Date', 'Emprunteur'], plusieurs: true },
]
/** Commentaire tel que l'écrit l'API (agent.ts, texteQuestions). */
const commentaire = (questions: unknown) => {
  const octets = new TextEncoder().encode(JSON.stringify(questions))
  const donnees = btoa(String.fromCharCode(...octets))
  return `${MARQUEUR_ASSISTANT}\n🤖 **Questions d’ADA**\n\nDeux règles à trancher.\n\n**Choix proposés** (à cocher dans ADA) :\n1. Retour…\n   - [ ] Oui\n\n<!-- ada:choix ${donnees} -->`
}

describe('Questions à choix d’ADA', () => {
  it('lit les choix joints au commentaire (accents compris)', () => {
    expect(lireChoix(commentaire(QUESTIONS))).toEqual(QUESTIONS)
    expect(lireChoix('Sans choix')).toEqual([])
    expect(lireChoix('<!-- ada:choix pas-du-base64! -->')).toEqual([])
  })

  it('n’affiche dans le fil ni les données cachées ni la liste répétée des choix', () => {
    const message = presenterMessage({ id: 1, auteur: 'robot', avatar: null, le: '', texte: commentaire(QUESTIONS) })
    expect(message.texte).toBe('🤖 **Questions d’ADA**\n\nDeux règles à trancher.')
  })

  it('compose une réponse lisible : options cochées et précision, question par question', () => {
    const texte = composerReponse(QUESTIONS, [
      { coches: ['Oui'], precision: '' },
      { coches: ['Nom', 'Date'], precision: '  et la catégorie  ' },
    ])
    expect(texte).toBe('1. Retour le jour même ?\n→ Oui\n\n2. Quelles colonnes afficher ?\n→ Nom ; Date\nPrécision : et la catégorie')
  })
})
