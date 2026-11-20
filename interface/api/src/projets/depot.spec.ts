import { describe, expect, it } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { identifiantProjet, lireIdentifiant, nomTechnique, verifierAcces } from './depot.js';

describe('identifiant d’un projet (#37)', () => {
  it('garde le simple nom pour l’organisation d’ADA : les adresses existantes ne changent pas', () => {
    expect(identifiantProjet('Proprio', 'Pret-De-Materiel', 'proprio')).toBe('pret-de-materiel');
    expect(lireIdentifiant('pret-de-materiel', 'proprio')).toEqual({ owner: 'proprio', repo: 'pret-de-materiel' });
  });

  it('préfixe par le compte un dépôt hors de l’organisation', () => {
    expect(identifiantProjet('Un-PO', 'Mon.POC', 'proprio')).toBe('un-po~mon.poc');
    expect(lireIdentifiant('un-po~mon.poc', 'proprio')).toEqual({ owner: 'un-po', repo: 'mon.poc' });
  });

  it('refuse un identifiant mal formé (chemins, séparateurs en trop, login invalide)', () => {
    for (const id of ['../etc', 'a b', 'a~b~c', '~poc', 'po~', '-po~poc', 'p--o~poc']) {
      expect(() => lireIdentifiant(id, 'proprio'), id).toThrow(BadRequestException);
    }
  });

  it('n’ouvre que les projets de l’organisation et du compte du PO connecté', () => {
    expect(() => verifierAcces({ owner: 'proprio', repo: 'poc' }, 'un-po', 'proprio')).not.toThrow();
    expect(() => verifierAcces({ owner: 'Un-PO', repo: 'poc' }, 'un-po', 'proprio')).not.toThrow();
    expect(() => verifierAcces({ owner: 'autre-po', repo: 'poc' }, 'un-po', 'proprio')).toThrow(ForbiddenException);
  });

  it('donne un nom accepté par docker compose', () => {
    expect(nomTechnique('apercu-un-po~mon.poc')).toBe('apercu-un-po-mon-poc');
  });
});
