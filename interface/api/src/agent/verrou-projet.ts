/** Verrou d'un projet : un seul agent à la fois y travaille, même entre plusieurs processus. */
import { ConflictException } from '@nestjs/common';
import { mkdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ecrireAtomique } from './lancement.js';
import { BATTEMENT_VERROU_MS, verrouVivant, type Verrou } from './verrou.js';

/** Un garde de reprise plus ancien que cela vient d'un processus tombé en route : on l'écarte. */
const DUREE_MAX_GARDE_MS = 10_000;

export class VerrouProjet {
  /** `dossierAgent` : dossier de travail de l'agent pour un projet (à côté de son aperçu). */
  constructor(private readonly dossierAgent: (depot: string) => string) {}

  chemin(depot: string): string {
    return join(this.dossierAgent(depot), 'verrou.json');
  }

  /** Verrou du projet, s'il est tenu par un processus vivant qui bat encore (sinon : reste d'une exécution interrompue). */
  async actif(depot: string): Promise<Verrou | null> {
    return verrouVivant(this.chemin(depot));
  }

  async poser(depot: string, verrou: Verrou): Promise<void> {
    await mkdir(this.dossierAgent(depot), { recursive: true });
    await ecrireAtomique(this.chemin(depot), JSON.stringify(verrou));
  }

  async liberer(depot: string): Promise<void> {
    await rm(this.chemin(depot), { force: true });
  }

  /** Signe de vie : un verrou qui ne bat plus est abandonné, même si son numéro de processus existe encore. Renvoie l'arrêt. */
  battre(depot: string): () => void {
    const battement = setInterval(() => {
      const maintenant = new Date();
      void utimes(this.chemin(depot), maintenant, maintenant).catch(() => undefined);
    }, BATTEMENT_VERROU_MS);
    battement.unref();
    return () => clearInterval(battement);
  }

  /**
   * Prise exclusive du verrou du projet : création qui échoue si le fichier existe déjà. Remplacer
   * un verrou abandonné (processus mort, ou sans battement) se fait sous un garde de reprise, créé
   * lui aussi de façon exclusive : un seul processus à la fois y vérifie que le verrou est bien
   * mort, l'efface et prend le sien. Sans ce garde, deux tâches qui le trouvent mort ensemble
   * pourraient l'une effacer le verrou tout neuf de l'autre, et travailler toutes deux sur le projet.
   */
  async acquerir(depot: string, verrou: Verrou): Promise<void> {
    const chemin = this.chemin(depot);
    const garde = `${chemin}.reprise`;
    await mkdir(this.dossierAgent(depot), { recursive: true });
    const occupe = () => new ConflictException('ADA travaille déjà sur ce projet');
    for (let essai = 0; essai < 40; essai++) {
      try {
        await writeFile(chemin, JSON.stringify(verrou), { flag: 'wx' });
        return;
      } catch (erreur) {
        if ((erreur as NodeJS.ErrnoException).code !== 'EEXIST') throw erreur;
      }
      if (await this.actif(depot)) throw occupe();
      try {
        await writeFile(garde, String(process.pid), { flag: 'wx' });
      } catch (erreur) {
        if ((erreur as NodeJS.ErrnoException).code !== 'EEXIST') throw erreur;
        // Une autre reprise est en cours ; si son garde date (processus tombé en route), on le retire.
        const age = Date.now() - (await stat(garde).then((fichier) => fichier.mtimeMs, () => Date.now()));
        if (age > DUREE_MAX_GARDE_MS) await rm(garde, { force: true });
        else await new Promise((ok) => setTimeout(ok, 25));
        continue;
      }
      try {
        if (await this.actif(depot)) throw occupe(); // une autre tâche a repris la main entre-temps
        await rm(chemin, { force: true });
        await writeFile(chemin, JSON.stringify(verrou), { flag: 'wx' });
        return;
      } catch (erreur) {
        if ((erreur as NodeJS.ErrnoException).code === 'EEXIST') throw occupe(); // une tâche toute neuve l'a pris
        throw erreur;
      } finally {
        await rm(garde, { force: true });
      }
    }
    throw occupe();
  }
}
