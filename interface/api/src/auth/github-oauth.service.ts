import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CONFIG, type Config } from '../config.js';

interface ReponseJeton {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

@Injectable()
export class GithubOAuthService {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  get urlRetour(): string {
    return `${this.config.URL_INTERFACE}/api/auth/github/callback`;
  }

  urlAutorisation(etat: string): string {
    const params = new URLSearchParams({
      client_id: this.config.GITHUB_CLIENT_ID,
      redirect_uri: this.urlRetour,
      state: etat,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /** Nouveau jeton à partir du jeton de renouvellement (jetons de GitHub App : 8 h, renouvellement : 6 mois). */
  async rafraichir(jetonRenouvellement: string): Promise<Required<Pick<ReponseJeton, 'access_token'>> & ReponseJeton> {
    const reponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.GITHUB_CLIENT_ID,
        client_secret: this.config.GITHUB_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: jetonRenouvellement,
      }),
    });
    const donnees = (await reponse.json()) as ReponseJeton;
    if (!reponse.ok || !donnees.access_token) {
      throw new UnauthorizedException(donnees.error_description ?? 'Renouvellement du jeton GitHub refusé');
    }
    return { ...donnees, access_token: donnees.access_token };
  }

  async echangerCode(code: string): Promise<Required<Pick<ReponseJeton, 'access_token'>> & ReponseJeton> {
    const reponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.GITHUB_CLIENT_ID,
        client_secret: this.config.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: this.urlRetour,
      }),
    });
    const donnees = (await reponse.json()) as ReponseJeton;
    if (!reponse.ok || !donnees.access_token) {
      throw new UnauthorizedException(donnees.error_description ?? 'Connexion GitHub refusée');
    }
    return { ...donnees, access_token: donnees.access_token };
  }
}
