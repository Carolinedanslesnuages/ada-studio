import type { Formulaire, Question } from './definition.ts';

export type Valeur = string | number | string[];
export type Valeurs = Record<string, Valeur>;

export type Resultat =
  | { valide: true; valeurs: Valeurs }
  | { valide: false; erreurs: Record<string, string> };

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEPHONE = /^\+?[0-9 .-]{10,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const longueurMax = (question: Question) => question.longueurMax ?? (question.type === 'texte-long' ? 5000 : 500);

/** Une réponse à une question : la valeur nettoyée, ou un message d'erreur clair. */
function validerQuestion(question: Question, brute: unknown): { valeur?: Valeur; erreur?: string } {
  const vide =
    brute === undefined || brute === null || (typeof brute === 'string' && brute.trim() === '') || (Array.isArray(brute) && brute.length === 0);
  if (vide) return question.obligatoire ? { erreur: `Le champ « ${question.libelle} » est obligatoire` } : {};

  switch (question.type) {
    case 'choix-multiple': {
      const choix = question.choix ?? [];
      if (!Array.isArray(brute) || !brute.every((valeur) => typeof valeur === 'string' && choix.includes(valeur))) {
        return { erreur: `Choisissez parmi les propositions de « ${question.libelle} »` };
      }
      return { valeur: [...new Set(brute as string[])] };
    }
    case 'choix-unique':
      if (typeof brute !== 'string' || !(question.choix ?? []).includes(brute)) {
        return { erreur: `Choisissez une des propositions de « ${question.libelle} »` };
      }
      return { valeur: brute };
    case 'nombre': {
      const nombre = typeof brute === 'number' ? brute : typeof brute === 'string' ? Number(brute.replace(',', '.')) : Number.NaN;
      if (!Number.isFinite(nombre)) return { erreur: `« ${question.libelle} » doit être un nombre` };
      return { valeur: nombre };
    }
    default: {
      if (typeof brute !== 'string') return { erreur: `« ${question.libelle} » doit être un texte` };
      const texte = brute.trim();
      if (texte.length > longueurMax(question)) {
        return { erreur: `« ${question.libelle} » : ${longueurMax(question)} caractères au maximum` };
      }
      if (question.type === 'courriel' && !COURRIEL.test(texte)) {
        return { erreur: 'Adresse électronique invalide. Format attendu : nom@domaine.fr' };
      }
      if (question.type === 'telephone' && !TELEPHONE.test(texte)) {
        return { erreur: 'Numéro de téléphone invalide. Format attendu : 01 23 45 67 89' };
      }
      if (question.type === 'date' && (!DATE.test(texte) || Number.isNaN(Date.parse(texte)))) {
        return { erreur: `« ${question.libelle} » : date invalide` };
      }
      return { valeur: texte };
    }
  }
}

/** Valide un envoi complet ; les champs inconnus sont ignorés (jamais enregistrés). */
export function validerReponse(formulaire: Formulaire, corps: unknown): Resultat {
  const saisie = typeof corps === 'object' && corps !== null && !Array.isArray(corps) ? (corps as Record<string, unknown>) : {};
  const valeurs: Valeurs = {};
  const erreurs: Record<string, string> = {};
  for (const question of formulaire.questions) {
    const { valeur, erreur } = validerQuestion(question, saisie[question.id]);
    if (erreur) erreurs[question.id] = erreur;
    else if (valeur !== undefined) valeurs[question.id] = valeur;
  }
  return Object.keys(erreurs).length > 0 ? { valide: false, erreurs } : { valide: true, valeurs };
}
