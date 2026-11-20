import { Inject, Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CONFIG, type Config } from '../config.js';
import { lireIdentifiant } from '../projets/depot.js';
import { enregistrer, type EntreeRegistre, type Origine } from './registre.js';

/**
 * Registre des projets créés ou repris par ADA, dans un fichier hors git. GitHub reste la source
 * de vérité de chaque projet ; le registre garde seulement la trace qu'il a existé, pour que les
 * indicateurs comptent aussi les projets archivés ou supprimés depuis.
 */
@Injectable()
export class RegistreService {
  private readonly journal = new Logger(RegistreService.name);
  private ecriture: Promise<void> = Promise.resolve();

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  private get fichier(): string {
    return join(resolve(this.config.DOSSIER_REGISTRE), 'projets.json');
  }

  async lire(): Promise<EntreeRegistre[]> {
    if (!existsSync(this.fichier)) return this.amorcer();
    try {
      return JSON.parse(await readFile(this.fichier, 'utf8')) as EntreeRegistre[];
    } catch (e) {
      this.journal.warn(`Registre illisible : ${(e as Error).message}`);
      return [];
    }
  }

  /** Note un projet (création, reprise, ou première trace) ; jamais bloquant pour le PO. */
  async noter(id: string, origine: Origine, par: string | null, le = new Date().toISOString()): Promise<void> {
    this.ecriture = this.ecriture.then(async () => {
      try {
        const { owner, repo } = lireIdentifiant(id, this.config.GITHUB_PROPRIETAIRE);
        const avant = await this.lire();
        const apres = enregistrer(avant, { id: id.toLowerCase(), owner, repo, origine, le, par });
        if (apres !== avant) await this.ecrire(apres);
      } catch (e) {
        this.journal.warn(`Registre : ${id} non noté (${(e as Error).message})`);
      }
    });
    return this.ecriture;
  }

  private async ecrire(registre: EntreeRegistre[]): Promise<void> {
    await mkdir(resolve(this.config.DOSSIER_REGISTRE), { recursive: true });
    const temporaire = `${this.fichier}.${process.pid}.tmp`;
    await writeFile(temporaire, `${JSON.stringify(registre, null, 2)}\n`);
    await rename(temporaire, this.fichier);
  }

  /**
   * Premier démarrage : les projets d'avant le registre ont laissé une trace, le dossier de leur
   * aperçu. Ils y entrent avec une origine inconnue, datés de la création de ce dossier.
   */
  private async amorcer(): Promise<EntreeRegistre[]> {
    const racine = resolve(this.config.DOSSIER_APERCUS);
    let registre: EntreeRegistre[] = [];
    const dossiers = await readdir(racine, { withFileTypes: true }).catch(() => []);
    for (const dossier of dossiers.filter((element) => element.isDirectory())) {
      try {
        const { owner, repo } = lireIdentifiant(dossier.name, this.config.GITHUB_PROPRIETAIRE);
        const { birthtime } = await stat(join(racine, dossier.name));
        registre = enregistrer(registre, { id: dossier.name, owner, repo, origine: 'inconnue', le: birthtime.toISOString(), par: null });
      } catch {
        // dossier qui n'est pas un projet
      }
    }
    await this.ecrire(registre);
    this.journal.log(`Registre créé avec ${registre.length} projet(s) déjà connus`);
    return registre;
  }
}
