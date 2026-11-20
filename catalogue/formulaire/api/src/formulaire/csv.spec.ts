import { describe, expect, it } from 'vitest';
import type { Formulaire } from './definition.ts';
import { cellule, versCsv } from './csv.ts';

const formulaire: Formulaire = {
  titre: 'Essai',
  introduction: '',
  messageConfirmation: 'Merci',
  questions: [
    { id: 'nom', libelle: 'Nom', type: 'texte', obligatoire: true },
    { id: 'sujets', libelle: 'Sujets', type: 'choix-multiple', obligatoire: false, choix: ['A', 'B'] },
  ],
};

describe('Export CSV des réponses', () => {
  it('une colonne par question, séparateur « ; », BOM pour les tableurs', () => {
    const csv = versCsv(formulaire, [{ id: 1, recueillieLe: '2026-11-16T10:00:00.000Z', valeurs: { nom: 'Camille', sujets: ['A', 'B'] } }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      '"N°";"Reçue le";"Nom";"Sujets"',
      '"1";"2026-11-16T10:00:00.000Z";"Camille";"A, B"',
      '',
    ]);
  });

  it('laisse vide une question sans réponse (ou ajoutée après coup)', () => {
    const csv = versCsv(formulaire, [{ id: 2, recueillieLe: 'x', valeurs: { nom: 'Lou' } }]);
    expect(csv).toContain('"2";"x";"Lou";""');
  });

  it('échappe les guillemets et neutralise les formules (injection CSV)', () => {
    expect(cellule('Il a dit "oui"')).toBe('"Il a dit ""oui"""');
    expect(cellule('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(cellule('+33 1 23')).toBe('"\'+33 1 23"');
    expect(cellule('-2')).toBe('"\'-2"');
    expect(cellule('@SOMME')).toBe('"\'@SOMME"');
  });
});
