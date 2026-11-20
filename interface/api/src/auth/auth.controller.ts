import { Controller, Get, Inject, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { CONFIG, loginAutorise, type Config } from '../config.js';
import { GithubService } from '../github/github.service.js';
import { ConnecteGuard } from './connecte.guard.js';
import { GithubOAuthService } from './github-oauth.service.js';
import type { UtilisateurConnecte } from './session.js';

@Controller('auth')
export class AuthController {
  private readonly journal = new Logger(AuthController.name);

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly oauth: GithubOAuthService,
    private readonly github: GithubService,
  ) {}

  /** Étape 1 : renvoie le PO vers GitHub pour qu'il autorise l'atelier. */
  @Get('github')
  connexion(@Req() req: Request, @Res() res: Response): void {
    const etat = randomBytes(16).toString('hex');
    req.session.etatOAuth = etat;
    res.redirect(this.oauth.urlAutorisation(etat));
  }

  /** Étape 2 : GitHub renvoie le PO ici avec un code à échanger contre un jeton. */
  @Get('github/callback')
  async retour(
    @Query('code') code: string | undefined,
    @Query('state') etat: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const attendu = req.session.etatOAuth;
    delete req.session.etatOAuth;
    if (!code || !etat || etat !== attendu) {
      res.redirect(`${this.config.URL_INTERFACE}/connexion?erreur=etat`);
      return;
    }
    let jeton: Awaited<ReturnType<GithubOAuthService['echangerCode']>>;
    try {
      jeton = await this.oauth.echangerCode(code);
    } catch (e) {
      // Identifiants de la GitHub App refusés, code expiré… : jamais de JSON brut pour le PO.
      this.journal.warn(`Échange du code GitHub refusé : ${(e as Error).message}`);
      res.redirect(`${this.config.URL_INTERFACE}/connexion?erreur=github`);
      return;
    }
    const { data } = await this.github.client(jeton.access_token).users.getAuthenticated();
    if (!loginAutorise(this.config, data.login)) {
      res.redirect(`${this.config.URL_INTERFACE}/connexion?erreur=non-autorise`);
      return;
    }
    await new Promise<void>((ok, ko) => req.session.regenerate((e) => (e ? ko(e) : ok())));
    req.session.jeton = jeton.access_token;
    req.session.jetonRafraichissement = jeton.refresh_token;
    req.session.jetonExpireLe = jeton.expires_in ? Date.now() + jeton.expires_in * 1000 : undefined;
    req.session.utilisateur = { login: data.login, nom: data.name, avatar: data.avatar_url };
    res.redirect(this.config.URL_INTERFACE);
  }

  @Get('moi')
  @UseGuards(ConnecteGuard)
  moi(@Req() req: Request): UtilisateurConnecte | undefined {
    return req.session.utilisateur;
  }

  @Post('deconnexion')
  async deconnexion(@Req() req: Request): Promise<{ ok: true }> {
    await new Promise<void>((ok) => req.session.destroy(() => ok()));
    return { ok: true };
  }
}
