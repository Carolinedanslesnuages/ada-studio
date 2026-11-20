/**
 * Ordonnancement des tâches de l'agent : une seule par projet (verrou partagé entre processus), au
 * plus AGENT_MAX_SIMULTANES sur toute la machine, puis une file d'attente. Chaque tâche tourne dans
 * un processus travailleur détaché, qui survit aux redémarrages de l'API.
 */
import { ConflictException, type Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApercuService } from '../apercu/apercu.service.js';
import type { Config } from '../config.js';
import type { Tache } from './agent.js';
import type { FileAttente } from './file-attente.js';
import type { JournalActivite } from './journal-activite.js';
import { lancerDetache } from './lancement.js';
import type { VerrouProjet } from './verrou-projet.js';

const FREQUENCE_FILE_MS = 5_000;
/** Au-delà, la tâche en attente est abandonnée : le jeton du PO aurait expiré. */
const ATTENTE_MAX_MS = 30 * 60_000;

export interface Collaborateurs {
  config: Config;
  apercu: ApercuService;
  verrou: VerrouProjet;
  journal: JournalActivite;
  file: FileAttente;
  /** Le travail d'une tâche, selon sa phase (dans ce processus). */
  travailler: (tache: Tache) => Promise<void>;
  /** Dossier de travail de l'agent pour un projet (fichiers de tâche, journaux du travailleur). */
  dossierAgent: (depot: string) => string;
  log: Logger;
}

export class Ordonnanceur {
  /**
   * Vrai : chaque tâche tourne dans un processus travailleur détaché, qui survit aux
   * redémarrages de l'API. Faux (tests, et dans le travailleur lui-même) : exécution directe.
   */
  travailleurSepare = !process.env.VITEST;
  /** Dernière tâche de fond lancée (permet aux tests d'en attendre la fin). */
  derniereTache: Promise<void> = Promise.resolve();
  private chaine: Promise<unknown> = Promise.resolve();
  private minuteurFile: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly c: Collaborateurs) {}

  /**
   * Libre : aucun agent ne tient le projet et aucune tâche n'y attend son tour. À vérifier AVANT
   * d'écrire quoi que ce soit dans GitHub (commentaire, statut) : sinon un refus laisserait l'issue
   * « en cours » sans agent.
   */
  async verifierLibre(depot: string): Promise<void> {
    if ((await this.c.verrou.actif(depot)) || (await this.c.file.contient(depot))) throw new ConflictException('ADA travaille déjà sur ce projet');
  }

  /** Démarre la tâche, ou la met en file d'attente si la machine a déjà assez d'agents au travail. */
  async lancer(tache: Tache): Promise<void> {
    await this.serialiser(async () => {
      await this.verifierLibre(tache.depot);
      if ((await this.agentsEnCours()) >= this.c.config.AGENT_MAX_SIMULTANES) {
        await this.mettreEnFile(tache);
        return;
      }
      await this.demarrer(tache);
    });
  }

  /** Une décision à la fois (compter les agents, puis prendre une place) : sinon deux lancements simultanés dépasseraient le plafond. */
  private serialiser<T>(travail: () => Promise<T>): Promise<T> {
    const suite = this.chaine.then(travail, travail);
    this.chaine = suite.catch(() => undefined);
    return suite;
  }

  private async agentsEnCours(): Promise<number> {
    return (await this.c.apercu.projetsAvecAgent()).length;
  }

  /** Prend le verrou du projet et lance la tâche ; en cas d'échec, rend le verrou (sinon le projet resterait « occupé »). */
  private async demarrer(tache: Tache): Promise<void> {
    await this.c.verrou.acquerir(tache.depot, { pid: process.pid, numero: tache.numero, phase: tache.phase });
    try {
      // L'agent lance ses commandes dans le conteneur de l'aperçu : s'il dormait, on le réveille.
      this.c.apercu.noterUtilisation(tache.depot);
      if (this.c.apercu.estEnVeille(tache.depot)) await this.c.apercu.demarrer(tache.jeton, tache.depot);
      await this.c.journal.enregistrer(tache.depot, tache.numero, {
        phase: tache.phase,
        enCours: true,
        debut: new Date().toISOString(),
        erreur: null,
      });
      if (this.travailleurSepare) {
        await this.demarrerTravailleur(tache);
        return;
      }
      this.derniereTache = this.executer(tache);
    } catch (e) {
      await this.c.verrou.liberer(tache.depot);
      // L'écran du PO affiche cette erreur avec « Relancer ADA » : l'issue ne reste pas « en cours » sans explication.
      await this.c.journal.enregistrer(tache.depot, tache.numero, { enCours: false, erreur: (e as Error).message }).catch(() => undefined);
      throw e;
    }
  }

  // ---- File d'attente : tâches qui attendent qu'un agent se libère ----------------------------------------------

  demarrerMinuteur(): void {
    if (!this.travailleurSepare) return;
    this.minuteurFile = setInterval(() => void this.traiterFile().catch((e: unknown) => this.c.log.warn(`File d'attente : ${(e as Error).message}`)), FREQUENCE_FILE_MS);
    this.minuteurFile.unref();
  }

  arreterMinuteur(): void {
    if (this.minuteurFile) clearInterval(this.minuteurFile);
  }

  private async mettreEnFile(tache: Tache): Promise<void> {
    const rang = await this.c.file.ajouter(tache);
    await this.c.journal.enregistrer(tache.depot, tache.numero, { phase: tache.phase, enCours: true, debut: new Date().toISOString(), erreur: null });
    await this.c.journal.noter(
      tache.depot,
      tache.numero,
      `En file d’attente (${rang}ᵉ) : ADA termine d’abord les demandes d’autres projets, puis s’y met toute seule`,
    );
  }

  /**
   * Démarre, dans l'ordre d'arrivée, les tâches en attente tant qu'il reste de la place. Appelée
   * toutes les quelques secondes par l'API. Une tâche qui attend depuis trop longtemps est
   * abandonnée (son jeton aurait expiré) : l'écran du PO propose alors « Relancer ADA ».
   */
  async traiterFile(maintenant = Date.now()): Promise<void> {
    for (const entree of await this.c.file.entrees()) {
      const { tache } = entree;
      const suite = await this.serialiser(async (): Promise<'plein' | 'suivante'> => {
        if (await this.c.verrou.actif(tache.depot)) return 'suivante';
        if (maintenant - Date.parse(entree.le) > ATTENTE_MAX_MS) {
          await this.c.file.retirer(entree);
          await this.c.journal.enregistrer(tache.depot, tache.numero, { enCours: false, erreur: 'ADA n’a pas pu s’y mettre à temps : trop de demandes en même temps. Relancez-la.' });
          await this.c.journal.noter(tache.depot, tache.numero, 'Attente trop longue : à relancer');
          return 'suivante';
        }
        if ((await this.agentsEnCours()) >= this.c.config.AGENT_MAX_SIMULTANES) return 'plein';
        await this.c.file.retirer(entree);
        await this.demarrer(tache).catch((e: unknown) => this.c.log.warn(`Tâche en file ${tache.depot}#${tache.numero} non démarrée : ${(e as Error).message}`));
        return 'suivante';
      });
      if (suite === 'plein') break;
    }
  }

  /**
   * Processus détaché : il survit à un redémarrage de l'API. La tâche (avec le jeton du PO) lui
   * est passée par un fichier lisible par le seul utilisateur, qu'il supprime dès sa lecture.
   */
  private async demarrerTravailleur(tache: Tache): Promise<void> {
    const dossier = this.c.dossierAgent(tache.depot);
    await mkdir(dossier, { recursive: true });
    const fichierTache = join(dossier, `tache-${tache.numero}-${Date.now()}.json`);
    await writeFile(fichierTache, JSON.stringify(tache), { mode: 0o600 });
    const pid = await lancerDetache(join(import.meta.dirname, 'travailleur.js'), fichierTache, join(dossier, `${tache.numero}.travailleur.log`));
    await this.c.verrou.poser(tache.depot, { pid, numero: tache.numero, phase: tache.phase });
  }

  /** Exécute la tâche dans ce processus (travailleur, ou tests) et tient l'activité à jour. */
  async executer(tache: Tache): Promise<void> {
    const { depot, numero, phase } = tache;
    await this.c.verrou.poser(depot, { pid: process.pid, numero, phase });
    const arreterBattement = this.c.verrou.battre(depot);
    try {
      await this.c.travailler(tache);
      await this.c.journal.enregistrer(depot, numero, { enCours: false });
    } catch (e) {
      const message = (e as Error).message;
      this.c.log.warn(`Agent sur ${depot}#${numero} (${phase}) : ${message}`);
      await this.c.journal.enregistrer(depot, numero, { enCours: false, erreur: message });
    } finally {
      arreterBattement();
      await this.c.verrou.liberer(depot);
    }
  }
}
