import type { Formulaire } from '@/services/formulaire'

/** Formulaire d'essai (données fictives) partagé par les tests. */
export const FORMULAIRE_ESSAI: Formulaire = {
  titre: 'Inscription à l’atelier',
  introduction: 'Merci de répondre.',
  messageConfirmation: 'Merci, votre réponse a bien été enregistrée.',
  questions: [
    { id: 'nom', libelle: 'Nom et prénom', type: 'texte', obligatoire: true },
    { id: 'courriel', libelle: 'Adresse électronique', type: 'courriel', obligatoire: true, aide: 'Format attendu : nom@domaine.fr' },
    { id: 'service', libelle: 'Votre service', type: 'choix-unique', obligatoire: true, choix: ['RH', 'Informatique'] },
    { id: 'sujets', libelle: 'Sujets', type: 'choix-multiple', obligatoire: false, choix: ['Formation', 'Équipement'] },
    { id: 'message', libelle: 'Votre message', type: 'texte-long', obligatoire: false },
  ],
}

/** Réponse HTTP JSON simulée pour fetch. */
export const reponseJson = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })
