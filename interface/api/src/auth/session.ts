import 'express-session';

export interface UtilisateurConnecte {
  login: string;
  nom: string | null;
  avatar: string;
}

declare module 'express-session' {
  interface SessionData {
    jeton?: string;
    jetonExpireLe?: number;
    jetonRafraichissement?: string;
    utilisateur?: UtilisateurConnecte;
    etatOAuth?: string;
  }
}
