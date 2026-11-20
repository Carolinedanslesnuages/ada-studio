import { describe, it, expect } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type session from 'express-session';
import { MagasinSessionsChiffre } from './magasin-sessions.js';

const JETON = 'gho_jeton_du_po_a_ne_jamais_ecrire_en_clair';
const donnees = (expires: Date) =>
  ({ cookie: { expires, originalMaxAge: 1000 }, jeton: JETON, utilisateur: { login: 'po' } }) as unknown as session.SessionData;

const lire = (m: MagasinSessionsChiffre, sid: string) =>
  new Promise<session.SessionData | null | undefined>((ok) => m.get(sid, (_e, s) => ok(s)));
const ecrire = (m: MagasinSessionsChiffre, sid: string, s: session.SessionData) =>
  new Promise<void>((ok) => m.set(sid, s, () => ok()));

describe('Magasin de sessions chiffré', () => {
  const nouveau = () => {
    const dossier = mkdtempSync(join(tmpdir(), 'sessions-'));
    return { dossier, magasin: new MagasinSessionsChiffre(dossier, 'x'.repeat(32)) };
  };

  it('retrouve la session après un redémarrage (nouvelle instance, même secret)', async () => {
    const { dossier, magasin } = nouveau();
    await ecrire(magasin, 'sid-1', donnees(new Date(Date.now() + 60_000)));
    const apresRedemarrage = new MagasinSessionsChiffre(dossier, 'x'.repeat(32));
    expect((await lire(apresRedemarrage, 'sid-1'))?.jeton).toBe(JETON);
  });

  it('n’écrit jamais le jeton ni l’identifiant de session en clair', async () => {
    const { dossier, magasin } = nouveau();
    await ecrire(magasin, 'sid-secret', donnees(new Date(Date.now() + 60_000)));
    const [fichier] = readdirSync(dossier);
    expect(fichier).not.toContain('sid-secret');
    expect(readFileSync(join(dossier, fichier!), 'utf8')).not.toContain(JETON);
  });

  it('ignore une session modifiée sur le disque ou chiffrée avec un autre secret', async () => {
    const { dossier, magasin } = nouveau();
    await ecrire(magasin, 'sid-2', donnees(new Date(Date.now() + 60_000)));
    expect(await lire(new MagasinSessionsChiffre(dossier, 'y'.repeat(32)), 'sid-2')).toBeNull();
    const [fichier] = readdirSync(dossier);
    const contenu = JSON.parse(readFileSync(join(dossier, fichier!), 'utf8')) as { contenu: string };
    writeFileSync(join(dossier, fichier!), JSON.stringify({ ...contenu, contenu: Buffer.from('falsifie').toString('base64') }));
    expect(await lire(magasin, 'sid-2')).toBeNull();
  });

  it('oublie une session expirée', async () => {
    const { dossier, magasin } = nouveau();
    await ecrire(magasin, 'sid-3', donnees(new Date(Date.now() - 1000)));
    expect(await lire(magasin, 'sid-3')).toBeNull();
    expect(readdirSync(dossier)).toEqual([]);
  });
});
