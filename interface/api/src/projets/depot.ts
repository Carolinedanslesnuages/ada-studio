import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Identifiant d'un projet dans ADA (URL, dossiers d'aperçu, ports) :
 * - `nom` pour un dépôt du propriétaire par défaut (GITHUB_PROPRIETAIRE), comme avant la reprise ;
 * - `compte~nom` pour un dépôt d'un autre compte (compte personnel du PO, #37).
 * `~` n'existe ni dans un login ni dans un nom de dépôt GitHub : la lecture est sans ambiguïté.
 * Tout est en minuscules (GitHub ignore la casse des noms).
 */
export const SEPARATEUR = '~';
const LOGIN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;
export const NOM_DEPOT = /^[a-z0-9][a-z0-9._-]{0,99}$/;

export interface CibleDepot {
  owner: string;
  repo: string;
}

export function identifiantProjet(owner: string, repo: string, proprietaireParDefaut: string): string {
  const compte = owner.toLowerCase();
  const nom = repo.toLowerCase();
  return compte === proprietaireParDefaut.toLowerCase() ? nom : `${compte}${SEPARATEUR}${nom}`;
}

/** Owner et repo d'un identifiant ; 400 si l'identifiant est mal formé. */
export function lireIdentifiant(id: string, proprietaireParDefaut: string): CibleDepot {
  const morceaux = id.toLowerCase().split(SEPARATEUR);
  const [owner, repo] = morceaux.length === 1 ? [proprietaireParDefaut, morceaux[0]] : morceaux;
  if (morceaux.length > 2 || !owner || !repo || !LOGIN.test(owner.toLowerCase()) || !NOM_DEPOT.test(repo)) {
    throw new BadRequestException('Projet inconnu');
  }
  return { owner, repo };
}

/**
 * Comptes dont un PO peut ouvrir les projets dans ADA : l'organisation d'ADA et son propre compte.
 * Les droits GitHub du PO s'appliquent en plus (son jeton n'ouvre que ce qu'il peut voir).
 */
export function verifierAcces(cible: CibleDepot, login: string, proprietaireParDefaut: string): void {
  const autorises = [proprietaireParDefaut.toLowerCase(), login.toLowerCase()];
  if (!autorises.includes(cible.owner.toLowerCase())) throw new ForbiddenException('Ce projet n’appartient ni à l’organisation ni à votre compte');
}

/** Nom utilisable par docker compose (minuscules, chiffres, « - » et « _ »). */
export function nomTechnique(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}
