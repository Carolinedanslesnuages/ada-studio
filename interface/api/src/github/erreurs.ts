import { ForbiddenException, HttpException, Logger, NotFoundException } from '@nestjs/common';

const journal = new Logger('GitHub');

/** Méthode, adresse et statut de l'appel GitHub en échec — jamais le jeton. */
export function decrireErreurGithub(erreur: unknown): string {
  const e = erreur as { status?: number; request?: { method?: string; url?: string }; message?: string };
  return `${e.request?.method ?? '?'} ${e.request?.url ?? '?'} → ${e.status ?? '?'} ${e.message ?? ''}`.trim();
}

/** Traduit une erreur de l'API GitHub en erreur HTTP compréhensible pour l'interface. */
export function traduireErreurGithub(erreur: unknown): never {
  const statut = (erreur as { status?: number }).status;
  if (statut) journal.warn(decrireErreurGithub(erreur));
  if (statut === 404) throw new NotFoundException('Introuvable sur GitHub, ou accès non autorisé');
  if (statut === 403) throw new ForbiddenException('GitHub refuse cette action pour votre compte');
  if (statut === 401) throw new HttpException('Session GitHub expirée, reconnectez-vous', 401);
  throw erreur;
}
