import { describe, it, expect } from 'vitest'
import { calculerScore, estJuste, lireQuiz, type Quiz } from '../quiz'
import donnees from '@/donnees/quiz.json'

const quiz: Quiz = {
  titre: 'Essai',
  introduction: '',
  seuilReussite: 50,
  questions: [
    { id: 'q1', enonce: 'Une ?', type: 'unique', choix: [{ id: 'a', texte: 'A' }, { id: 'b', texte: 'B' }], bonnes: ['a'], explication: '' },
    { id: 'q2', enonce: 'Plusieurs ?', type: 'multiple', choix: [{ id: 'a', texte: 'A' }, { id: 'b', texte: 'B' }, { id: 'c', texte: 'C' }], bonnes: ['a', 'c'], explication: '' },
  ],
}

describe('Quiz', () => {
  it('juste seulement si l’on coche exactement les bonnes réponses', () => {
    expect(estJuste(quiz.questions[0]!, ['a'])).toBe(true)
    expect(estJuste(quiz.questions[0]!, ['b'])).toBe(false)
    expect(estJuste(quiz.questions[1]!, ['c', 'a'])).toBe(true)
    expect(estJuste(quiz.questions[1]!, ['a'])).toBe(false)
    expect(estJuste(quiz.questions[1]!, ['a', 'b', 'c'])).toBe(false)
  })

  it('calcule le score et la réussite selon le seuil', () => {
    expect(calculerScore(quiz, { q1: ['a'], q2: ['a'] })).toEqual({ justes: 1, total: 2, pourcentage: 50, reussi: true })
    expect(calculerScore(quiz, {})).toEqual({ justes: 0, total: 2, pourcentage: 0, reussi: false })
  })

  it('refuse un fichier de questions incohérent, en expliquant pourquoi', () => {
    expect(() => lireQuiz({ ...quiz, questions: [{ ...quiz.questions[0]!, bonnes: ['z'] }] })).toThrow(/les bonnes réponses doivent faire partie des choix/)
    expect(() => lireQuiz({ ...quiz, questions: [{ ...quiz.questions[0]!, bonnes: ['a', 'b'] }] })).toThrow(/une seule bonne réponse/)
    expect(() => lireQuiz({ ...quiz, questions: [quiz.questions[0]!, quiz.questions[0]!] })).toThrow(/identifiant en double/)
    expect(() => lireQuiz({ ...quiz, seuilReussite: 150 })).toThrow(/pourcentage/)
  })

  it('le fichier de questions du projet est valide', () => {
    expect(() => lireQuiz(donnees)).not.toThrow()
  })
})
