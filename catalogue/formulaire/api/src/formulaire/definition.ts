/**
 * LE formulaire du projet : ses questions, dans l'ordre d'affichage. Ajouter, retirer ou modifier
 * une question se fait ICI (l'écran, la validation, la page « Réponses » et l'export CSV suivent).
 * Ne jamais réutiliser l'identifiant d'une question supprimée : les anciennes réponses le portent.
 */
export type TypeQuestion =
  | 'texte'
  | 'texte-long'
  | 'courriel'
  | 'telephone'
  | 'nombre'
  | 'date'
  | 'choix-unique'
  | 'choix-multiple';

export interface Question {
  /** Identifiant stable (minuscules, chiffres, tirets) : colonne de l'export CSV. */
  id: string;
  libelle: string;
  aide?: string;
  type: TypeQuestion;
  obligatoire: boolean;
  /** Choix proposés (types « choix-unique » et « choix-multiple »). */
  choix?: string[];
  /** Longueur maximale d'un texte (500 par défaut, 5000 pour « texte-long »). */
  longueurMax?: number;
}

export interface Formulaire {
  titre: string;
  introduction: string;
  messageConfirmation: string;
  questions: Question[];
}

export const FORMULAIRE: Formulaire = {
  titre: '__NOM_PROJET__',
  introduction: 'Merci de prendre quelques minutes pour répondre.',
  messageConfirmation: 'Merci, votre réponse a bien été enregistrée.',
  questions: [
    { id: 'nom', libelle: 'Nom et prénom', type: 'texte', obligatoire: true },
    { id: 'courriel', libelle: 'Adresse électronique', aide: 'Format attendu : nom@domaine.fr', type: 'courriel', obligatoire: true },
    {
      id: 'service',
      libelle: 'Votre service',
      type: 'choix-unique',
      obligatoire: true,
      choix: ['Direction', 'Ressources humaines', 'Informatique', 'Autre'],
    },
    {
      id: 'sujets',
      libelle: 'Sujets qui vous intéressent',
      aide: 'Plusieurs choix possibles',
      type: 'choix-multiple',
      obligatoire: false,
      choix: ['Formation', 'Équipement', 'Télétravail'],
    },
    { id: 'message', libelle: 'Votre message', type: 'texte-long', obligatoire: false },
  ],
};
