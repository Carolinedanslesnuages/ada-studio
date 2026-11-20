import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lireConfig } from '../config.js';
import { bilan, enregistrer, etatProjet, type EntreeRegistre } from './registre.js';
import { RegistreService } from './registre.service.js';

const entree = (id: string, origine: EntreeRegistre['origine']): EntreeRegistre => ({ id, owner: 'proprio', repo: id, origine, le: '2026-11-16T10:00:00Z', par: null });

describe('registre des projets', () => {
  it('ne fait que grandir ; une trace d’origine inconnue est précisée dès qu’on la connaît', () => {
    const registre = enregistrer([entree('poc', 'inconnue')], entree('poc', 'cree'));
    expect(registre).toEqual([{ ...entree('poc', 'cree') }]);
    expect(enregistrer(registre, entree('poc', 'repris'))).toBe(registre);
    expect(enregistrer(registre, entree('autre', 'repris'))).toHaveLength(2);
  });

  it('état d’après GitHub : actif, archivé, retiré d’ADA, supprimé', () => {
    expect(etatProjet({ archived: false, topics: ['ada-studio'] }, 'ada-studio')).toBe('actif');
    expect(etatProjet({ archived: true, topics: ['ada-studio'] }, 'ada-studio')).toBe('archive');
    expect(etatProjet({ archived: false, topics: [] }, 'ada-studio')).toBe('retire');
    expect(etatProjet(null, 'ada-studio')).toBe('supprime');
  });

  it('bilan : créés (origine inconnue comprise) et repris, par état', () => {
    expect(bilan([{ origine: 'cree', etat: 'actif' }, { origine: 'inconnue', etat: 'supprime' }, { origine: 'repris', etat: 'archive' }])).toEqual({
      total: 3, crees: 2, repris: 1, actifs: 1, archives: 1, retires: 0, supprimes: 1,
    });
  });

  it('premier démarrage : amorcé avec les projets qui ont eu un aperçu, puis complété au fil de l’eau', async () => {
    const racine = mkdtempSync(join(tmpdir(), 'registre-'));
    for (const projet of ['pret-de-materiel', 'cleo', 'un-po~mon-poc']) mkdirSync(join(racine, 'apercus', projet), { recursive: true });
    const config = lireConfig({ GITHUB_PROPRIETAIRE: 'proprio', GITHUB_CLIENT_ID: 'Iv', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: 'x'.repeat(32), DOSSIER_APERCUS: join(racine, 'apercus'), DOSSIER_REGISTRE: join(racine, 'registre') });
    const service = new RegistreService(config);
    expect((await service.lire()).map((ligne) => [ligne.id, ligne.owner, ligne.origine]).sort((premier, second) => premier[0]!.localeCompare(second[0]!))).toEqual([
      ['cleo', 'proprio', 'inconnue'],
      ['pret-de-materiel', 'proprio', 'inconnue'],
      ['un-po~mon-poc', 'un-po', 'inconnue'],
    ]);
    await service.noter('signalements', 'cree', 'po');
    await service.noter('cleo', 'cree', 'po');
    const fichier = JSON.parse(readFileSync(join(racine, 'registre', 'projets.json'), 'utf8')) as EntreeRegistre[];
    expect(fichier.find((ligne) => ligne.id === 'signalements')).toMatchObject({ origine: 'cree', par: 'po' });
    expect(fichier.find((ligne) => ligne.id === 'cleo')).toMatchObject({ origine: 'cree' });
  });
});
