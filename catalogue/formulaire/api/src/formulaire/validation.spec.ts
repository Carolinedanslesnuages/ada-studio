import { describe, expect, it } from 'vitest';
import type { Formulaire } from './definition.ts';
import { FORMULAIRE } from './definition.ts';
import { validerReponse } from './validation.ts';

const formulaire: Formulaire = {
  titre: 'Essai',
  introduction: '',
  messageConfirmation: 'Merci',
  questions: [
    { id: 'nom', libelle: 'Nom', type: 'texte', obligatoire: true },
    { id: 'courriel', libelle: 'Courriel', type: 'courriel', obligatoire: false },
    { id: 'telephone', libelle: 'Téléphone', type: 'telephone', obligatoire: false },
    { id: 'age', libelle: 'Âge', type: 'nombre', obligatoire: false },
    { id: 'jour', libelle: 'Jour', type: 'date', obligatoire: false },
    { id: 'service', libelle: 'Service', type: 'choix-unique', obligatoire: false, choix: ['RH', 'Informatique'] },
    { id: 'sujets', libelle: 'Sujets', type: 'choix-multiple', obligatoire: false, choix: ['A', 'B'] },
    { id: 'court', libelle: 'Court', type: 'texte', obligatoire: false, longueurMax: 3 },
  ],
};

describe('Validation d’une réponse', () => {
  it('accepte une réponse complète et nettoie les valeurs', () => {
    const resultat = validerReponse(formulaire, {
      nom: '  Camille  ',
      courriel: 'camille@exemple.fr',
      telephone: '01 23 45 67 89',
      age: '42',
      jour: '2026-11-16',
      service: 'RH',
      sujets: ['A', 'A', 'B'],
    });
    expect(resultat).toEqual({
      valide: true,
      valeurs: { nom: 'Camille', courriel: 'camille@exemple.fr', telephone: '01 23 45 67 89', age: 42, jour: '2026-11-16', service: 'RH', sujets: ['A', 'B'] },
    });
  });

  it('signale chaque champ obligatoire manquant, même rempli d’espaces', () => {
    expect(validerReponse(formulaire, { nom: '   ' })).toEqual({ valide: false, erreurs: { nom: 'Le champ « Nom » est obligatoire' } });
    expect(validerReponse(formulaire, { nom: 'Camille', age: '  ' })).toEqual({ valide: true, valeurs: { nom: 'Camille' } });
    expect(validerReponse(formulaire, null)).toMatchObject({ valide: false, erreurs: { nom: expect.any(String) } });
  });

  it.each([
    ['courriel', 'pas-une-adresse', /Format attendu : nom@domaine.fr/],
    ['telephone', 'abc', /téléphone invalide/],
    ['age', 'beaucoup', /doit être un nombre/],
    ['jour', '16/11/2026', /date invalide/],
    ['service', 'Compta', /Choisissez une des propositions/],
    ['sujets', ['C'], /Choisissez parmi/],
    ['sujets', 'A', /Choisissez parmi/],
    ['court', 'trop long', /3 caractères au maximum/],
    ['nom', 42, /doit être un texte/],
  ])('refuse une valeur invalide pour « %s »', (champ, valeur, message) => {
    const resultat = validerReponse(formulaire, { nom: 'Camille', [champ]: valeur });
    expect(resultat.valide).toBe(false);
    if (!resultat.valide) expect(resultat.erreurs[champ]).toMatch(message);
  });

  it('n’enregistre jamais un champ qui n’est pas une question', () => {
    const resultat = validerReponse(formulaire, { nom: 'Camille', administrateur: true });
    expect(resultat).toEqual({ valide: true, valeurs: { nom: 'Camille' } });
  });

  it('le formulaire du projet a des identifiants uniques et des choix pour chaque question à choix', () => {
    const identifiants = FORMULAIRE.questions.map((question) => question.id);
    expect(new Set(identifiants).size).toBe(identifiants.length);
    for (const question of FORMULAIRE.questions) {
      expect(question.id).toMatch(/^[a-z0-9-]+$/);
      if (question.type.startsWith('choix')) expect(question.choix?.length).toBeGreaterThan(0);
    }
  });
});
