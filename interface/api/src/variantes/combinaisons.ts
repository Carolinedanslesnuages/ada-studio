import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Composants, Style } from '../ada/ada-config.js';
import { RACINE_ADA } from '../edition/edition.js';

/**
 * Styles, bibliothèques de composants et combinaisons interdites : une seule source,
 * variantes/combinaisons.json à la racine d'ADA studio (lue aussi par scripts/variantes.mjs).
 */
export interface Option {
  valeur: string;
  nom: string;
  pourQui: string;
  doc: string;
  libelleDoc?: string;
}
export interface Combinaisons {
  parDefaut: { style: Style; composants: Composants };
  styles: Option[];
  composants: Option[];
  interdites: { style: Style; composants: Composants; raison: string }[];
}

export const DOSSIER_VARIANTES = join(RACINE_ADA, 'variantes');

export function lireCombinaisons(dossier: string = DOSSIER_VARIANTES): Combinaisons {
  return JSON.parse(readFileSync(join(dossier, 'combinaisons.json'), 'utf8')) as Combinaisons;
}

/** null si la combinaison est autorisée ; sinon la raison du refus, en une phrase. */
export function raisonRefus(style: Style, composants: Composants, combinaisons: Combinaisons = lireCombinaisons()): string | null {
  return combinaisons.interdites.find((regle) => regle.style === style && regle.composants === composants)?.raison ?? null;
}

export const nomStyle = (style: Style, combinaisons: Combinaisons = lireCombinaisons()) =>
  combinaisons.styles.find((option) => option.valeur === style)?.nom ?? style;
export const nomComposants = (composants: Composants, combinaisons: Combinaisons = lireCombinaisons()) =>
  combinaisons.composants.find((option) => option.valeur === composants)?.nom ?? composants;

type Appliquer = (options: { projet: string; front: string; style: Style; composants: Composants }) => Promise<void>;

/**
 * Applique style puis composants au projet copié (fonction unique : scripts/variantes.mjs, aussi
 * utilisée par la CI pour la matrice des modèles). Refuse une combinaison interdite.
 */
export async function appliquerVariantes(options: { projet: string; front: string; style: Style; composants: Composants }): Promise<void> {
  const module = (await import(pathToFileURL(join(RACINE_ADA, 'scripts', 'variantes.mjs')).href)) as { appliquerVariantes: Appliquer };
  await module.appliquerVariantes(options);
}
