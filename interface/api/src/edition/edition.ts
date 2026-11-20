import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Édition d'ADA. Deux ADA coexistent sur la même machine et le même compte GitHub : l'ADA du
 * travail (~/atelier-po) et ADA studio (~/ada-studio). Le fichier EDITION, à la racine, contient
 * « studio » : sans lui, l'API refuse de démarrer, pour ne jamais confondre les deux.
 */
export const EDITION = 'studio';

/** Racine du dépôt d'ADA studio (même chemin depuis src/ et dist/). */
export const RACINE_ADA = resolve(import.meta.dirname, '..', '..', '..', '..');

/** Sujets GitHub (topics) de l'ADA du travail : ses projets ne s'ouvrent pas dans ADA studio. */
export const TOPICS_AUTRE_EDITION = ['ada', 'atelier-po', 'ada-reprise', 'ada-creation'];

export const MESSAGE_AUTRE_EDITION =
  'Ce projet appartient à une autre édition d’ADA (celle du travail) : ADA studio ne l’ouvre pas, pour ne pas mélanger les deux. Ouvrez-le dans l’ADA qui l’a créé.';

/** Contenu du fichier EDITION de la racine donnée ; null s'il est absent. */
export function lireEdition(racine: string = RACINE_ADA): string | null {
  try {
    return readFileSync(join(racine, 'EDITION'), 'utf8').trim();
  } catch {
    return null;
  }
}

/** Refuse de démarrer hors d'ADA studio, avec un message clair. */
export function exigerEdition(racine: string = RACINE_ADA): void {
  const edition = lireEdition(racine);
  if (edition === null) throw new Error('Ce n’est pas ADA studio : fichier EDITION manquant');
  if (edition !== EDITION) throw new Error(`Ce n’est pas ADA studio : le fichier EDITION contient « ${edition} » au lieu de « ${EDITION} »`);
}

/** Un dépôt GitHub marqué par l'autre édition (topics de l'ADA du travail). */
export function estAutreEdition(topics: string[] | undefined, topicStudio: string): boolean {
  const liste = topics ?? [];
  return !liste.includes(topicStudio) && liste.some((topic) => TOPICS_AUTRE_EDITION.includes(topic));
}
