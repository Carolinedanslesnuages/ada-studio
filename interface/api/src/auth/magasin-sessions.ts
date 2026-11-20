import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import session from 'express-session';

/**
 * Sessions sur disque, chiffrées (AES-256-GCM) : un redémarrage de l'API ne déconnecte plus
 * personne, et le jeton GitHub n'est jamais écrit en clair. Fichier nommé par l'empreinte
 * de l'identifiant de session (l'identifiant lui-même n'apparaît nulle part sur le disque).
 */
export class MagasinSessionsChiffre extends session.Store {
  private readonly cle: Buffer;

  constructor(
    private readonly dossier: string,
    secret: string,
  ) {
    super();
    this.cle = scryptSync(secret, 'ada-studio:sessions', 32);
    mkdirSync(dossier, { recursive: true, mode: 0o700 });
  }

  private chemin(sid: string): string {
    return join(this.dossier, `${createHash('sha256').update(sid).digest('hex')}.json`);
  }

  chiffrer(donnees: unknown): string {
    const iv = randomBytes(12);
    const chiffreur = createCipheriv('aes-256-gcm', this.cle, iv);
    const contenu = Buffer.concat([chiffreur.update(JSON.stringify(donnees), 'utf8'), chiffreur.final()]);
    return JSON.stringify({
      iv: iv.toString('base64'),
      tag: chiffreur.getAuthTag().toString('base64'),
      contenu: contenu.toString('base64'),
    });
  }

  dechiffrer(texte: string): session.SessionData {
    const { iv, tag, contenu } = JSON.parse(texte) as { iv: string; tag: string; contenu: string };
    const dechiffreur = createDecipheriv('aes-256-gcm', this.cle, Buffer.from(iv, 'base64'));
    dechiffreur.setAuthTag(Buffer.from(tag, 'base64'));
    const clair = Buffer.concat([dechiffreur.update(Buffer.from(contenu, 'base64')), dechiffreur.final()]);
    return JSON.parse(clair.toString('utf8')) as session.SessionData;
  }

  override get(sid: string, rappel: (err: unknown, s?: session.SessionData | null) => void): void {
    readFile(this.chemin(sid), 'utf8')
      .then((texte) => {
        const donnees = this.dechiffrer(texte);
        const expire = donnees.cookie?.expires ? new Date(donnees.cookie.expires).getTime() : Infinity;
        if (expire < Date.now()) return this.destroy(sid, () => rappel(null, null));
        rappel(null, donnees);
      })
      // Absente, illisible ou falsifiée (étiquette GCM invalide) : pas de session.
      .catch(() => rappel(null, null));
  }

  override set(sid: string, donnees: session.SessionData, rappel?: (err?: unknown) => void): void {
    writeFile(this.chemin(sid), this.chiffrer(donnees), { mode: 0o600 })
      .then(() => rappel?.())
      .catch((e: unknown) => rappel?.(e));
  }

  override destroy(sid: string, rappel?: (err?: unknown) => void): void {
    rm(this.chemin(sid), { force: true })
      .then(() => rappel?.())
      .catch((e: unknown) => rappel?.(e));
  }

  override touch(sid: string, donnees: session.SessionData, rappel?: () => void): void {
    this.set(sid, donnees, () => rappel?.());
  }
}
