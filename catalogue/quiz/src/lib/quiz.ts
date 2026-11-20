/**
 * Le quiz : lecture et vérification du fichier de questions, correction et score (fonctions
 * pures). Les questions vivent dans src/donnees/quiz.json : c'est là qu'on en ajoute.
 */
export interface Choix {
  id: string
  texte: string
}

export interface Question {
  id: string
  enonce: string
  /** « unique » : une seule bonne réponse ; « multiple » : cocher toutes les bonnes. */
  type: 'unique' | 'multiple'
  choix: Choix[]
  bonnes: string[]
  explication: string
}

export interface Quiz {
  titre: string
  introduction: string
  /** Pourcentage de bonnes réponses pour réussir. */
  seuilReussite: number
  questions: Question[]
}

/** Vérifie le fichier de questions ; une erreur explique précisément ce qui ne va pas. */
export function lireQuiz(donnees: unknown): Quiz {
  const quiz = donnees as Quiz
  const erreurs: string[] = []
  if (!quiz?.titre) erreurs.push('le quiz n’a pas de titre')
  if (!Array.isArray(quiz?.questions) || quiz.questions.length === 0) erreurs.push('le quiz n’a aucune question')
  if (typeof quiz?.seuilReussite !== 'number' || quiz.seuilReussite < 0 || quiz.seuilReussite > 100) {
    erreurs.push('seuilReussite doit être un pourcentage entre 0 et 100')
  }
  const identifiants = new Set<string>()
  for (const question of quiz?.questions ?? []) {
    const nom = `question « ${question.id} »`
    if (identifiants.has(question.id)) erreurs.push(`${nom} : identifiant en double`)
    identifiants.add(question.id)
    if (!question.enonce) erreurs.push(`${nom} : énoncé manquant`)
    if (!['unique', 'multiple'].includes(question.type)) erreurs.push(`${nom} : type « unique » ou « multiple » attendu`)
    if (!Array.isArray(question.choix) || question.choix.length < 2) erreurs.push(`${nom} : au moins deux choix`)
    const choix = new Set((question.choix ?? []).map((possibilite) => possibilite.id))
    if (!Array.isArray(question.bonnes) || question.bonnes.length === 0 || !question.bonnes.every((bonne) => choix.has(bonne))) {
      erreurs.push(`${nom} : les bonnes réponses doivent faire partie des choix`)
    }
    if (question.type === 'unique' && question.bonnes?.length !== 1) erreurs.push(`${nom} : une seule bonne réponse pour le type « unique »`)
  }
  if (erreurs.length) throw new Error(`Fichier de questions invalide : ${erreurs.join(' ; ')}`)
  return quiz
}

/** Juste si l'on a coché exactement les bonnes réponses. */
export function estJuste(question: Question, reponse: string[]): boolean {
  const bonnes = [...question.bonnes].sort()
  const donnees = [...new Set(reponse)].sort()
  return bonnes.length === donnees.length && bonnes.every((bonne, rang) => bonne === donnees[rang])
}

export function calculerScore(quiz: Quiz, reponses: Record<string, string[]>) {
  const justes = quiz.questions.filter((question) => estJuste(question, reponses[question.id] ?? [])).length
  const pourcentage = Math.round((justes / quiz.questions.length) * 100)
  return { justes, total: quiz.questions.length, pourcentage, reussi: pourcentage >= quiz.seuilReussite }
}

export const bonnesReponses = (question: Question) =>
  question.choix.filter((possibilite) => question.bonnes.includes(possibilite.id)).map((possibilite) => possibilite.texte)
