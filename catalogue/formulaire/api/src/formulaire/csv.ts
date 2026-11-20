import type { Formulaire } from './definition.ts';
import type { Valeurs } from './validation.ts';

export interface Reponse {
  id: number;
  recueillieLe: string;
  valeurs: Valeurs;
}

/**
 * Cellule CSV sûre : guillemets doublés, et neutralisation des formules (une cellule qui
 * commence par = + - @ serait exécutée par un tableur : injection CSV).
 */
export function cellule(valeur: string | number | string[] | undefined): string {
  let texte = Array.isArray(valeur) ? valeur.join(', ') : valeur === undefined ? '' : String(valeur);
  if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
  return `"${texte.replaceAll('"', '""')}"`;
}

/** Export CSV pour un tableur français : séparateur « ; », BOM UTF-8, une colonne par question. */
export function versCsv(formulaire: Formulaire, reponses: Reponse[]): string {
  const entete = ['N°', 'Reçue le', ...formulaire.questions.map((question) => question.libelle)];
  const lignes = reponses.map((reponse) => [
    reponse.id,
    reponse.recueillieLe,
    ...formulaire.questions.map((question) => reponse.valeurs[question.id]),
  ]);
  return '﻿' + [entete, ...lignes].map((ligne) => ligne.map(cellule).join(';')).join('\r\n') + '\r\n';
}
