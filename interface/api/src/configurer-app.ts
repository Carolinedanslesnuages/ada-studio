import type { INestApplication } from '@nestjs/common';
import session from 'express-session';
import { MagasinSessionsChiffre } from './auth/magasin-sessions.js';
import type { Config } from './config.js';

/** Réglages communs à main.ts et aux tests e2e. */
export function configurerApp(app: INestApplication, config: Config): void {
  app.setGlobalPrefix('api', { exclude: ['__version__', 'api/__version__'] });
  app.use(
    session({
      name: 'ada-studio.sid',
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: new MagasinSessionsChiffre(config.DOSSIER_SESSIONS, config.SESSION_SECRET),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
}
