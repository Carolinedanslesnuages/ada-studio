import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { estAutreEdition, exigerEdition, lireEdition, RACINE_ADA } from './edition.js';

const dossier = (contenu?: string) => {
  const racine = mkdtempSync(join(tmpdir(), 'edition-'));
  if (contenu !== undefined) writeFileSync(join(racine, 'EDITION'), contenu);
  return racine;
};

describe('Édition d’ADA studio', () => {
  it('le dépôt d’ADA studio porte le fichier EDITION « studio »', () => {
    expect(lireEdition(RACINE_ADA)).toBe('studio');
    expect(() => exigerEdition()).not.toThrow();
  });

  it('sans fichier EDITION, l’API refuse de démarrer avec un message clair', () => {
    expect(() => exigerEdition(dossier())).toThrow('Ce n’est pas ADA studio : fichier EDITION manquant');
  });

  it('avec une autre édition, elle refuse aussi', () => {
    expect(() => exigerEdition(dossier('travail\n'))).toThrow('le fichier EDITION contient « travail »');
    expect(() => exigerEdition(dossier('studio\n'))).not.toThrow();
  });

  it('reconnaît un projet de l’ADA du travail à ses sujets GitHub', () => {
    expect(estAutreEdition(['ada'], 'ada-studio')).toBe(true);
    expect(estAutreEdition(['atelier-po', 'autre'], 'ada-studio')).toBe(true);
    expect(estAutreEdition(['ada-studio'], 'ada-studio')).toBe(false);
    expect(estAutreEdition([], 'ada-studio')).toBe(false);
  });
});
