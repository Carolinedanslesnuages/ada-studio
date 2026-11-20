import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ApercuService } from '../apercu/apercu.service.js';
import {
  adresseDemo,
  attribuerPort,
  etatDepuisPs,
  genererCompose,
  genererScriptDemarrage,
  genererScriptTravail,
  PLAGE_DEMO,
  volumesPartages,
} from '../apercu/apercu.js';
import { CONFIG, type Config } from '../config.js';
import { isolerGit } from '../apercu/git-isole.js';

export interface Demo {
  etat: 'arrete' | 'demarrage' | 'pret' | 'erreur';
  /** Adresse publique à partager (sans connexion), quand la démo est prête. */
  url: string | null;
  /** Sans aperçu démarré, pas de lien : le PO voit pourquoi. */
  apercuDemarre: boolean;
}

/**
 * Lien de démonstration : une seconde instance du projet, sur la dernière version validée
 * (branche main), jamais sur le travail en cours de l'assistant. Ses données sont séparées de
 * celles de l'aperçu. Démarrée à la demande, mise à jour après chaque fusion.
 */
@Injectable()
export class DemoService {
  private readonly journal = new Logger(DemoService.name);
  private readonly enPreparation = new Set<string>();

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly apercu: ApercuService,
  ) {}

  private dossier(projet: string): string {
    return join(this.apercu.dossierProjet(projet), 'demo');
  }

  private async port(projet: string): Promise<number> {
    const fichier = join(resolve(this.config.DOSSIER_APERCUS), 'ports-demo.json');
    const attribues = (await readFile(fichier, 'utf8').then(JSON.parse).catch(() => ({}))) as Record<string, number>;
    const port = attribuerPort(projet, attribues, PLAGE_DEMO);
    if (attribues[projet] !== port) {
      await mkdir(resolve(this.config.DOSSIER_APERCUS), { recursive: true });
      await writeFile(fichier, JSON.stringify({ ...attribues, [projet]: port }, null, 2));
    }
    return port;
  }

  async etat(projet: string): Promise<Demo> {
    const apercuDemarre = this.apercu.apercuDemarre(projet);
    const dossier = this.dossier(projet);
    if (this.enPreparation.has(projet)) return { etat: 'demarrage', url: null, apercuDemarre };
    if (!existsSync(join(dossier, 'compose.yml'))) return { etat: 'arrete', url: null, apercuDemarre };
    const port = await this.port(projet);
    const { stdout } = await this.apercu.executer('docker', ['compose', '-f', 'compose.yml', 'ps', '-a', '--format', 'json'], { cwd: dossier });
    const etat = etatDepuisPs(stdout, await this.apercu.repond(`http://localhost:${port}`));
    return { etat, url: etat === 'pret' ? adresseDemo(this.config.URL_DEMO, projet, port) : null, apercuDemarre };
  }

  /** Copie de main, à jour : la démo ne montre que ce qui a été validé et fusionné. */
  private async preparerDepot(jeton: string, projet: string): Promise<string> {
    const depot = join(this.dossier(projet), 'depot');
    const env = this.apercu.environnementGit(jeton);
    const git = (...args: string[]) => this.apercu.executer('git', ['-C', depot, ...args], { env });
    if (!existsSync(join(depot, '.git'))) {
      await mkdir(this.dossier(projet), { recursive: true });
      const url = this.apercu.urlDepot(projet);
      const dossierGit = join(this.dossier(projet), 'git');
      await rm(dossierGit, { recursive: true, force: true }); // reste d'un clone interrompu
      await this.apercu.executer('git', ['clone', '--quiet', '--branch', 'main', '--separate-git-dir', dossierGit, url, depot], { env });
      return depot;
    }
    await isolerGit(depot);
    // Copie réservée à la démo, jamais modifiée à la main : on l'aligne sur main (données ignorées par git conservées).
    await git('fetch', '--quiet', 'origin', 'main');
    await git('checkout', '--quiet', '-B', 'main', 'origin/main');
    await git('reset', '--quiet', '--hard', 'origin/main');
    return depot;
  }

  async demarrer(jeton: string, projet: string): Promise<Demo> {
    if (!this.apercu.apercuDemarre(projet)) {
      throw new BadRequestException('Démarrez d’abord l’aperçu du projet : le lien de démonstration en dépend.');
    }
    if (this.enPreparation.has(projet)) return this.etat(projet);
    this.enPreparation.add(projet);
    const dossier = this.dossier(projet);
    try {
      const depot = await this.preparerDepot(jeton, projet);
      const config = await this.apercu.lireConfig(depot);
      const port = await this.port(projet);
      const hote = new URL(adresseDemo(this.config.URL_DEMO, projet, port)).hostname;
      await writeFile(join(dossier, 'compose.yml'), genererCompose(projet, port, config, { nom: `demo-${projet}`, hotesAutorises: [hote] }));
      await writeFile(join(dossier, 'demarrer.sh'), genererScriptDemarrage(config), { mode: 0o755 });
      await writeFile(join(dossier, 'travail.sh'), genererScriptTravail(config), { mode: 0o755 });
      for (const volume of volumesPartages(config)) await this.apercu.executer('docker', ['volume', 'create', volume]);
      await this.apercu.executer('docker', ['compose', '-f', 'compose.yml', 'up', '-d', '--remove-orphans'], { cwd: dossier });
    } catch (e) {
      this.journal.warn(`Démo de ${projet} : ${(e as Error).message.split('\n')[0]}`);
      throw new BadRequestException('Le lien de démonstration n’a pas pu être préparé. Réessayez ; si cela persiste, prévenez un développeur.');
    } finally {
      this.enPreparation.delete(projet);
    }
    return this.etat(projet);
  }

  /** Après une fusion : la démo (si elle existe) passe à la nouvelle version validée. */
  async mettreAJour(jeton: string, projet: string): Promise<void> {
    const dossier = this.dossier(projet);
    if (!existsSync(join(dossier, 'compose.yml'))) return;
    await this.preparerDepot(jeton, projet);
    await this.apercu.executer('docker', ['compose', '-f', 'compose.yml', 'restart', 'app'], { cwd: dossier });
  }
}
