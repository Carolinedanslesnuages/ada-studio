import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADA_PAR_DEFAUT, COMPOSANTS, EditionIncompatible, lireAdaConfig, STYLES } from './ada-config.js';
import { RACINE_ADA } from '../edition/edition.js';

describe('ada.json — description d’un modèle', () => {
  it('sans fichier : comportement des projets existants (Vue + NestJS + PostgreSQL)', () => {
    expect(lireAdaConfig(null)).toBe(ADA_PAR_DEFAUT);
    expect(ADA_PAR_DEFAUT.apercu.base).toBe('postgres');
  });

  it('lit une maquette sans base ni API, avec les valeurs par défaut', () => {
    const config = lireAdaConfig(
      JSON.stringify({
        type: 'maquette',
        edition: 'studio',
        controlesRequis: ['Maquette'],
        controles: ['cd /app && npm test'],
        apercu: { npm: ['.'], principal: 'cd /app && npx vite --host 0.0.0.0 --port 5173' },
      }),
    );
    expect(config).toMatchObject({ type: 'maquette', personnaliser: [], apercu: { base: null, image: 'node:24-bookworm', port: 5173, avant: [], arrierePlan: [] } });
  });

  describe('édition, style et composants', () => {
    const projet = (champs: Record<string, unknown>) =>
      JSON.stringify({ type: 'service', controlesRequis: ['M'], controles: ['x'], apercu: { principal: 'npx vite' }, ...champs });

    it('refuse d’ouvrir un projet d’une autre édition d’ADA, en expliquant pourquoi', () => {
      expect(() => lireAdaConfig(projet({}))).toThrow(EditionIncompatible);
      expect(() => lireAdaConfig(projet({ edition: 'travail' }))).toThrow(/autre édition d’ADA/);
    });

    it('lit le style et la bibliothèque choisis à la création', () => {
      const config = lireAdaConfig(projet({ edition: 'studio', style: 'tailwind', composants: 'shadcn-vue', interface: { dossier: 'front', variantes: true } }));
      expect(config).toMatchObject({ edition: 'studio', style: 'tailwind', composants: 'shadcn-vue', interface: { dossier: 'front', variantes: true } });
    });

    it('projet repris : ni style ni bibliothèque imposés', () => {
      expect(lireAdaConfig(projet({ edition: 'studio' }))).toMatchObject({ style: null, composants: null, interface: null });
    });

    it('refuse un style inconnu', () => {
      expect(() => lireAdaConfig(projet({ edition: 'studio', style: 'bootstrap' }))).toThrow(/ada\.json invalide : style/);
    });

    it('les valeurs possibles sont celles de variantes/combinaisons.json', () => {
      const combinaisons = JSON.parse(readFileSync(join(RACINE_ADA, 'variantes', 'combinaisons.json'), 'utf8')) as {
        styles: { valeur: string }[];
        composants: { valeur: string }[];
      };
      expect(combinaisons.styles.map((option) => option.valeur)).toEqual([...STYLES]);
      expect(combinaisons.composants.map((option) => option.valeur)).toEqual([...COMPOSANTS]);
    });
  });

  it('refuse un ada.json incomplet, en disant quoi', () => {
    expect(() => lireAdaConfig(JSON.stringify({ type: 'fusee', apercu: {} }))).toThrow(/ada\.json invalide : .*type/);
  });

  describe('valeurs qui finissent dans compose.yml et dans les scripts', () => {
    const avec = (apercu: Record<string, unknown>) =>
      JSON.stringify({ type: 'maquette', edition: 'studio', controlesRequis: ['M'], controles: ['x'], apercu: { principal: 'npx vite', ...apercu } });

    it.each(['node:24-bookworm', 'python:3.13-slim', 'ghcr.io/org/image:1.2'])('accepte l’image %s', (image) => {
      expect(lireAdaConfig(avec({ image })).apercu.image).toBe(image);
    });

    it.each([
      'node:24\n    privileged: true',
      'node:24 --privileged',
      'node:24"\n    volumes: ["/:/hote"]',
      '../image',
      'Node:24',
      '',
    ])('refuse l’image %j', (image) => {
      expect(() => lireAdaConfig(avec({ image }))).toThrow(/ada\.json invalide : apercu\.image/);
    });

    it.each(['.', 'api', 'front', 'services/api', './front'])('accepte le dossier %s', (dossier) => {
      expect(lireAdaConfig(avec({ npm: [dossier], pip: [dossier] })).apercu.npm).toEqual([dossier]);
    });

    it.each(['..', '../hors', 'api/../../hors', '/etc', 'api; curl evil|sh', 'api\nautre', 'a b', '$(id)', 'api/', ''])(
      'refuse le dossier %j (npm comme pip)',
      (dossier) => {
        expect(() => lireAdaConfig(avec({ npm: [dossier] }))).toThrow(/apercu\.npm/);
        expect(() => lireAdaConfig(avec({ pip: [dossier] }))).toThrow(/apercu\.pip/);
      },
    );
  });
});
