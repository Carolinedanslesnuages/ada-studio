import { BadRequestException, Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { CONFIG, type Config } from '../config.js';
import { lireAdaConfig, type AdaConfig } from '../ada/ada-config.js';
import {
  attribuerPort,
  PLAGE_COMPOSANTS,
  etatDepuisPs,
  genererCompose,
  genererScriptDemarrage,
  genererScriptTravail,
  volumesPartages,
  type EtatApercu,
} from './apercu.js';
import { lireIdentifiant } from '../projets/depot.js';
import { verrouVivant } from '../agent/verrou.js';
import { environnementGitIsole, isolerGit } from './git-isole.js';

export interface Apercu {
  etat: EtatApercu;
  url: string | null;
  /** Dernières lignes du journal du conteneur, utiles quand l'état est « erreur ». */
  journal: string | null;
}

export type Executer = (
  commande: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string }>;

const execFileAsync = promisify(execFile);
/**
 * git lancé sur le dépôt d'un aperçu (`git -C <dépôt> …`) : son dossier git est désigné
 * explicitement, hors du dossier monté dans le conteneur (voir git-isole.ts).
 */
export const executerParDefaut: Executer = (commande, args, options) => {
  const depot = commande === 'git' && args[0] === '-C' ? args[1] : undefined;
  const env = depot ? environnementGitIsole(options?.env ?? process.env, depot) : options?.env;
  return execFileAsync(commande, args, { ...options, ...(env ? { env } : {}), maxBuffer: 10 * 1024 * 1024 });
};

/** Un aperçu sans usage depuis ce délai est mis en veille : le Mac ne fait plus tourner tous les projets. */
export const DELAI_VEILLE_MS = 30 * 60 * 1000;
const FREQUENCE_VEILLE_MS = 5 * 60 * 1000;
/** Fichier posé dans le dossier d'un aperçu mis en veille : il est arrêté, pas en panne. */
const MARQUE_VEILLE = 'en-veille';

@Injectable()
export class ApercuService implements OnModuleInit, OnModuleDestroy {
  private readonly journal = new Logger(ApercuService.name);
  private readonly enPreparation = new Set<string>();
  /** Dernier usage de chaque aperçu (écran qui l'affiche, agent qui y travaille). */
  private readonly utilisations = new Map<string, number>();
  /** Au démarrage de l'API, chacun a droit au délai complet. */
  private readonly demarrageApi = Date.now();
  private minuteurVeille: ReturnType<typeof setInterval> | null = null;
  executer: Executer = executerParDefaut;
  repond: (url: string) => Promise<boolean> = async (url) => {
    try {
      return (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
      return false;
    }
  };

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  onModuleInit(): void {
    this.minuteurVeille = setInterval(() => void this.mettreEnVeille().catch((e: unknown) => this.journal.warn(`Mise en veille : ${(e as Error).message}`)), FREQUENCE_VEILLE_MS);
    this.minuteurVeille.unref();
  }

  onModuleDestroy(): void {
    if (this.minuteurVeille) clearInterval(this.minuteurVeille);
  }

  /** Aperçu mis en veille faute d'usage : à réveiller avant qu'un agent y travaille. */
  estEnVeille(projet: string): boolean {
    return existsSync(join(this.dossierProjet(projet), MARQUE_VEILLE));
  }

  /** L'aperçu sert (affiché, ou un agent y travaille) : il reste allumé. */
  noterUtilisation(projet: string): void {
    this.utilisations.set(projet, Date.now());
  }

  /** Un agent travaille dans ce projet (son verrou existe, son processus vit et bat encore) : on n'y touche pas. */
  private agentActif(projet: string): boolean {
    return verrouVivant(join(this.racine, projet, 'agent', 'verrou.json')) !== null;
  }

  /** Projets où un agent travaille en ce moment : sert à plafonner le nombre d'agents sur la machine. */
  async projetsAvecAgent(): Promise<string[]> {
    const dossiers = await readdir(this.racine).catch(() => [] as string[]);
    return dossiers.filter((projet) => this.agentActif(projet));
  }

  /**
   * Met en veille les aperçus inutilisés depuis DELAI_VEILLE_MS : conteneurs arrêtés (données et
   * installation gardées), redémarrés à la prochaine ouverture du projet. Renvoie les projets arrêtés.
   */
  async mettreEnVeille(maintenant = Date.now()): Promise<string[]> {
    const arretes: string[] = [];
    const projets = await readdir(this.racine).catch(() => [] as string[]);
    for (const projet of projets) {
      const dossier = join(this.racine, projet);
      if (!existsSync(join(dossier, 'compose.yml')) || existsSync(join(dossier, MARQUE_VEILLE))) continue;
      const dernierUsage = this.utilisations.get(projet) ?? this.demarrageApi;
      if (maintenant - dernierUsage < DELAI_VEILLE_MS || this.enPreparation.has(projet) || this.agentActif(projet)) continue;
      await this.executer('docker', ['compose', '-f', 'compose.yml', 'stop'], { cwd: dossier });
      await writeFile(join(dossier, MARQUE_VEILLE), new Date(maintenant).toISOString());
      this.journal.log(`Aperçu de ${projet} mis en veille (inutilisé depuis ${Math.round((maintenant - dernierUsage) / 60000)} min)`);
      arretes.push(projet);
    }
    return arretes;
  }

  private get racine(): string {
    return resolve(this.config.DOSSIER_APERCUS);
  }

  private verifier(projet: string): void {
    lireIdentifiant(projet, this.config.GITHUB_PROPRIETAIRE);
  }

  /** Adresse git du dépôt d'un projet (organisation d'ADA ou compte du PO). */
  urlDepot(projet: string): string {
    const { owner, repo } = lireIdentifiant(projet, this.config.GITHUB_PROPRIETAIRE);
    return `https://github.com/${owner}/${repo}.git`;
  }

  private async ports(): Promise<Record<string, number>> {
    try {
      return JSON.parse(await readFile(join(this.racine, 'ports.json'), 'utf8')) as Record<string, number>;
    } catch {
      return {};
    }
  }

  private async port(projet: string): Promise<number> {
    const attribues = await this.ports();
    const port = attribuerPort(projet, attribues);
    if (attribues[projet] !== port) {
      await mkdir(this.racine, { recursive: true });
      await writeFile(join(this.racine, 'ports.json'), JSON.stringify({ ...attribues, [projet]: port }, null, 2));
    }
    return port;
  }

  /** Port du Storybook de l'aperçu (onglet « Composants »), dans sa propre plage. */
  async portComposants(projet: string): Promise<number> {
    const fichier = join(this.racine, 'ports-composants.json');
    const attribues = JSON.parse(await readFile(fichier, 'utf8').catch(() => '{}')) as Record<string, number>;
    const port = attribuerPort(projet, attribues, PLAGE_COMPOSANTS);
    if (attribues[projet] !== port) {
      await mkdir(this.racine, { recursive: true });
      await writeFile(fichier, JSON.stringify({ ...attribues, [projet]: port }, null, 2));
    }
    return port;
  }

  async etat(projet: string): Promise<Apercu> {
    this.verifier(projet);
    this.noterUtilisation(projet);
    const dossier = join(this.racine, projet);
    if (!this.enPreparation.has(projet) && existsSync(join(dossier, MARQUE_VEILLE))) return { etat: 'arrete', url: null, journal: null };
    if (!existsSync(join(dossier, 'compose.yml'))) {
      return { etat: this.enPreparation.has(projet) ? 'demarrage' : 'arrete', url: null, journal: null };
    }
    const url = `http://localhost:${await this.port(projet)}`;
    const { stdout } = await this.executer('docker', ['compose', '-f', 'compose.yml', 'ps', '-a', '--format', 'json'], {
      cwd: dossier,
    });
    const etat = this.enPreparation.has(projet) ? 'demarrage' : etatDepuisPs(stdout, await this.repond(url));
    return { etat, url: etat === 'pret' ? url : null, journal: etat === 'pret' ? null : await this.dernieresLignes(dossier) };
  }

  /** ada.json du projet ; absent (projets d'avant ada.json) → comportement Vue + NestJS. */
  async lireConfig(depot: string): Promise<AdaConfig> {
    return lireAdaConfig(await readFile(join(depot, 'ada.json'), 'utf8').catch(() => null));
  }

  /** Dossier de travail d'un projet (aperçu, démo, assistant). */
  dossierProjet(projet: string): string {
    this.verifier(projet);
    return join(this.racine, projet);
  }

  /** L'aperçu de travail a été démarré (ses conteneurs existent). */
  apercuDemarre(projet: string): boolean {
    return existsSync(join(this.dossierProjet(projet), 'compose.yml'));
  }

  cheminDepot(projet: string): string {
    this.verifier(projet);
    return join(this.racine, projet, 'depot');
  }

  /** Environnement git authentifié : le jeton passe par l'environnement, jamais en argument ni dans .git/config. */
  environnementGit(jeton: string): NodeJS.ProcessEnv {
    const auth = Buffer.from(`x-access-token:${jeton}`).toString('base64');
    return {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}`,
    };
  }

  /**
   * Clone le dépôt, ou le met à jour sans toucher au travail en cours : on récupère GitHub, et on
   * n'avance la copie locale que si elle est sur main (une branche de story reste telle quelle).
   */
  async preparerDepot(jeton: string, projet: string): Promise<string> {
    const depot = this.cheminDepot(projet);
    await mkdir(join(this.racine, projet), { recursive: true });
    const env = this.environnementGit(jeton);
    if (existsSync(join(depot, '.git'))) {
      await isolerGit(depot);
      await this.executer('git', ['-C', depot, 'fetch', '--quiet', 'origin'], { env });
      const { stdout } = await this.executer('git', ['-C', depot, 'rev-parse', '--abbrev-ref', 'HEAD']);
      if (stdout.trim() === 'main') {
        await this.executer('git', ['-C', depot, 'merge', '--ff-only', '--quiet', 'origin/main'], { env });
      }
    } else {
      const url = this.urlDepot(projet);
      // Dossier git rangé à côté du dépôt, hors du dossier monté dans le conteneur (voir git-isole.ts).
      const dossierGit = join(this.racine, projet, 'git');
      await rm(dossierGit, { recursive: true, force: true }); // reste d'un clone interrompu
      await this.executer('git', ['clone', '--quiet', '--separate-git-dir', dossierGit, url, depot], { env });
    }
    return depot;
  }

  /**
   * Après une fusion : la copie de l'aperçu revient sur main, à jour. Les retouches npm des
   * package-lock.json sont rétablies ; le rechargement à chaud affiche le projet fusionné.
   */
  async revenirSurMain(jeton: string, projet: string): Promise<void> {
    const depot = this.cheminDepot(projet);
    const env = this.environnementGit(jeton);
    const git = (...args: string[]) => this.executer('git', ['-C', depot, ...args], { env });
    await git('fetch', '--quiet', 'origin');
    const { stdout } = await git('status', '--porcelain');
    const verrous = stdout
      .split('\n')
      .map((l) => l.slice(3).trim())
      .filter((f) => f.endsWith('package-lock.json'));
    if (verrous.length) await git('checkout', '--', ...verrous);
    await git('checkout', '--quiet', 'main');
    await git('merge', '--ff-only', '--quiet', 'origin/main');
  }

  /**
   * Relance l'application de l'aperçu (API en arrière-plan) après un changement de branche fait par
   * git : le rechargement automatique (node --watch, nest --watch) ne voit pas toujours les
   * fichiers remplacés, et l'aperçu servirait alors l'ancienne API. Le front seul non plus : le
   * rechargement à chaud de Vite peut garder d'anciens modules. Rien à faire s'il est en veille.
   */
  async relancerApplication(projet: string): Promise<void> {
    this.verifier(projet);
    const dossier = join(this.racine, projet);
    if (!existsSync(join(dossier, 'compose.yml')) || existsSync(join(dossier, MARQUE_VEILLE))) return;
    // Toujours, même sans API en arrière-plan : après un changement de branche (des dizaines de
    // fichiers d'un coup), le rechargement à chaud de Vite garde parfois d'anciens modules et
    // l'application ne s'ouvre plus (Gladys : « ErreurReseau » introuvable).
    await this.executer('docker', ['compose', '-f', 'compose.yml', 'restart', 'app'], { cwd: dossier });
  }

  /** Prépare le dépôt avec les droits du PO, puis démarre les conteneurs. */
  async demarrer(jeton: string, projet: string): Promise<Apercu> {
    this.verifier(projet);
    if (this.enPreparation.has(projet)) return this.etat(projet);
    this.enPreparation.add(projet);
    this.noterUtilisation(projet);
    const dossier = join(this.racine, projet);
    try {
      const depot = await this.preparerDepot(jeton, projet);
      const config = await this.lireConfig(depot);
      const portComposants = config.interface ? await this.portComposants(projet) : undefined;
      await writeFile(join(dossier, 'compose.yml'), genererCompose(projet, await this.port(projet), config, { portComposants }));
      await writeFile(join(dossier, 'demarrer.sh'), genererScriptDemarrage(config), { mode: 0o755 });
      await writeFile(join(dossier, 'travail.sh'), genererScriptTravail(config), { mode: 0o755 });
      for (const volume of volumesPartages(config)) await this.executer('docker', ['volume', 'create', volume]);
      await this.executer('docker', ['compose', '-f', 'compose.yml', 'up', '-d', '--remove-orphans'], { cwd: dossier });
      await rm(join(dossier, MARQUE_VEILLE), { force: true });
    } catch (e) {
      this.journal.warn(`Aperçu de ${projet} : ${(e as Error).message.split('\n')[0]}`);
      throw new BadRequestException('L’aperçu n’a pas pu démarrer. Réessayez ; si cela persiste, prévenez un développeur.');
    } finally {
      this.enPreparation.delete(projet);
    }
    return this.etat(projet);
  }

  private async dernieresLignes(dossier: string): Promise<string | null> {
    try {
      const { stdout } = await this.executer('docker', ['compose', '-f', 'compose.yml', 'logs', 'app', '--tail', '15', '--no-color'], {
        cwd: dossier,
      });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
}
