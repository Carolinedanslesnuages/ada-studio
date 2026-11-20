import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CONFIG, type Config } from '../config.js';
import { traduireErreurGithub } from '../github/erreurs.js';
import { GithubService } from '../github/github.service.js';
import { estAutreEdition, MESSAGE_AUTRE_EDITION } from '../edition/edition.js';
import { lireIdentifiant, verifierAcces } from './depot.js';
import '../auth/session.js';

/** Un accès vérifié auprès de GitHub reste valable ce temps : le suivi de l'écran interroge toutes les 4 secondes. */
export const DUREE_ACCES_MS = 60_000;
const TAILLE_MAX_MEMOIRE = 500;

/**
 * Toute route `projets/:depot/…` : identifiant bien formé, projet de l'organisation d'ADA ou du
 * compte du PO connecté, ET dépôt que GitHub montre réellement à ce PO (son jeton). Le nom du
 * compte seul ne suffit pas : un dépôt privé de l'organisation n'est pas à tous ses membres, et
 * plusieurs routes (activité de l'agent, aperçu, empreinte) ne font aucun appel GitHub elles-mêmes.
 * À placer après ConnecteGuard.
 */
@Injectable()
export class ProjetGuard implements CanActivate {
  /** « login|compte/dépôt » → heure d'expiration. Seuls les accès accordés sont gardés. */
  private readonly acces = new Map<string, number>();

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly github: GithubService,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const requete = contexte.switchToHttp().getRequest<Request>();
    const id = String(requete.params.depot ?? '');
    const cible = lireIdentifiant(id, this.config.GITHUB_PROPRIETAIRE);
    const login = requete.session.utilisateur?.login ?? '';
    verifierAcces(cible, login, this.config.GITHUB_PROPRIETAIRE);

    const cle = `${login.toLowerCase()}|${cible.owner}/${cible.repo}`;
    if ((this.acces.get(cle) ?? 0) > Date.now()) return true;
    let topics: string[] | undefined;
    try {
      ({ data: { topics } } = await this.github.client(requete.session.jeton ?? '').repos.get({ owner: cible.owner, repo: cible.repo }));
    } catch (e) {
      traduireErreurGithub(e); // 404 / 403 : le dépôt n'est pas visible pour ce PO
    }
    // Projet de l'ADA du travail : ADA studio ne l'ouvre pas, et dit pourquoi.
    if (estAutreEdition(topics, this.config.TOPIC_ATELIER)) throw new ForbiddenException(MESSAGE_AUTRE_EDITION);
    this.memoriser(cle);
    return true;
  }

  private memoriser(cle: string): void {
    const maintenant = Date.now();
    if (this.acces.size >= TAILLE_MAX_MEMOIRE) {
      for (const [autre, expire] of this.acces) if (expire <= maintenant) this.acces.delete(autre);
      if (this.acces.size >= TAILLE_MAX_MEMOIRE) this.acces.clear();
    }
    this.acces.set(cle, maintenant + DUREE_ACCES_MS);
  }
}
