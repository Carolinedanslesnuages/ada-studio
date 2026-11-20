/**
 * File d'attente des tâches qui attendent qu'un agent se libère, hors de tout projet. Une entrée
 * par projet ; elle porte le jeton du PO : fichier lisible par le seul utilisateur.
 */
import { ConflictException } from '@nestjs/common';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Tache } from './agent.js';

export interface EntreeFile {
  tache: Tache;
  le: string;
  fichier: string;
}

export class FileAttente {
  /** `dossier` : dossier de la file (le point initial de « .file-attente » l'écarte des listes de projets). */
  constructor(private readonly dossier: () => string) {}

  /** Une seule entrée par projet : son nom l'identifie, et sa création exclusive empêche tout doublon. */
  private fichier(depot: string): string {
    return join(this.dossier(), `${Buffer.from(depot).toString('hex')}.json`);
  }

  private async lire(fichier: string): Promise<EntreeFile | null> {
    try {
      return { ...(JSON.parse(await readFile(fichier, 'utf8')) as Omit<EntreeFile, 'fichier'>), fichier };
    } catch {
      return null;
    }
  }

  /** Les tâches qui attendent leur tour, dans l'ordre d'arrivée. */
  async entrees(): Promise<EntreeFile[]> {
    const noms = await readdir(this.dossier()).catch(() => [] as string[]);
    const entrees = await Promise.all(noms.filter((nom) => nom.endsWith('.json')).map((nom) => this.lire(join(this.dossier(), nom))));
    return entrees.filter((entree): entree is EntreeFile => entree !== null).sort((a, b) => a.le.localeCompare(b.le));
  }

  /** Une tâche de ce projet (et de cette demande, si précisée) attend son tour. */
  async contient(depot: string, numero?: number): Promise<boolean> {
    const entree = await this.lire(this.fichier(depot));
    return entree !== null && (numero === undefined || entree.tache.numero === numero);
  }

  /** Met la tâche en attente ; refuse si son projet en a déjà une. Renvoie son rang (1 : la prochaine). */
  async ajouter(tache: Tache): Promise<number> {
    await mkdir(this.dossier(), { recursive: true, mode: 0o700 });
    try {
      // La tâche porte le jeton du PO : fichier lisible par le seul utilisateur, supprimé au départ de la tâche.
      await writeFile(this.fichier(tache.depot), JSON.stringify({ tache, le: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
    } catch (erreur) {
      if ((erreur as NodeJS.ErrnoException).code === 'EEXIST') throw new ConflictException('ADA travaille déjà sur ce projet');
      throw erreur;
    }
    return (await this.entrees()).findIndex((entree) => entree.tache.depot === tache.depot) + 1;
  }

  /** Une tâche part une seule fois : son entrée est retirée avant son départ. */
  async retirer(entree: EntreeFile): Promise<void> {
    await rm(entree.fichier, { force: true });
  }
}
