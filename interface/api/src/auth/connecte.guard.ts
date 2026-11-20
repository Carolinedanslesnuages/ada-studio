import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { GithubOAuthService } from './github-oauth.service.js';
import './session.js';

/**
 * Marge avant l'expiration du jeton GitHub au-delà de laquelle on le renouvelle. Elle couvre la
 * plus longue tâche de l'agent : le travailleur garde le jeton reçu à son lancement pour pousser
 * la branche et ouvrir la PR, qui échoueraient s'il expirait en cours de route.
 */
export const MARGE_RENOUVELLEMENT_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class ConnecteGuard implements CanActivate {
  private readonly journal = new Logger(ConnecteGuard.name);

  /** Renouvellements en cours, par jeton de renouvellement : GitHub invalide l'ancien dès son usage. */
  private readonly renouvellements = new Map<string, ReturnType<GithubOAuthService['rafraichir']>>();

  constructor(private readonly oauth: GithubOAuthService) {}

  /**
   * Plusieurs requêtes arrivent ensemble (l'écran interroge toutes les 4 secondes) : si chacune
   * renouvelait, la seconde présenterait un jeton déjà utilisé, serait refusée, et le PO déconnecté.
   * Les requêtes simultanées partagent donc un seul renouvellement.
   */
  private renouveler(jetonRenouvellement: string): ReturnType<GithubOAuthService['rafraichir']> {
    let enCours = this.renouvellements.get(jetonRenouvellement);
    if (!enCours) {
      enCours = this.oauth.rafraichir(jetonRenouvellement).finally(() => this.renouvellements.delete(jetonRenouvellement));
      this.renouvellements.set(jetonRenouvellement, enCours);
    }
    return enCours;
  }

  /**
   * Exige une session GitHub et renouvelle le jeton s'il expire bientôt (voir la marge ci-dessus), sans que le PO s'en
   * aperçoive. Renouvellement impossible : session fermée, reconnexion demandée.
   */
  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const requete = contexte.switchToHttp().getRequest<Request>();
    const session = requete.session;
    if (!session?.jeton) throw new UnauthorizedException('Connexion GitHub requise');
    const expireLe = session.jetonExpireLe;
    if (!expireLe || expireLe - Date.now() > MARGE_RENOUVELLEMENT_MS) return true;
    if (!session.jetonRafraichissement) {
      await new Promise<void>((fin) => session.destroy(() => fin()));
      throw new UnauthorizedException('Session GitHub expirée, reconnectez-vous');
    }
    try {
      const nouveau = await this.renouveler(session.jetonRafraichissement);
      session.jeton = nouveau.access_token;
      session.jetonRafraichissement = nouveau.refresh_token ?? session.jetonRafraichissement;
      session.jetonExpireLe = nouveau.expires_in ? Date.now() + nouveau.expires_in * 1000 : undefined;
      return true;
    } catch (erreur) {
      this.journal.warn(`Renouvellement du jeton refusé : ${(erreur as Error).message}`);
      await new Promise<void>((fin) => session.destroy(() => fin()));
      throw new UnauthorizedException('Session GitHub expirée, reconnectez-vous');
    }
  }
}
