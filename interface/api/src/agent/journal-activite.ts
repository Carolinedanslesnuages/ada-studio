/**
 * Activité d'une demande (phase, fil d'activité, erreur, PR, dernier commit poussé), rangée à côté
 * de l'aperçu du projet. C'est ce que l'écran du PO affiche pendant que l'agent travaille.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Phase } from './agent.js';
import { ecrireAtomique } from './lancement.js';

export interface Activite {
  phase: Phase | null;
  enCours: boolean;
  debut: string | null;
  journal: { le: string; texte: string }[];
  erreur: string | null;
  pullRequest: string | null;
  /** Conversation : session de l'agent, reprise d'un message à l'autre (garder le fil). */
  session?: string | null;
  /**
   * Dernier commit de la branche tel qu'ADA l'a poussé. À la fusion, une branche qui a avancé en
   * dehors d'ADA (des commits ajoutés par quelqu'un d'autre) n'est plus ce que le PO a vérifié.
   */
  tete?: string | null;
}

const VIDE: Activite = { phase: null, enCours: false, debut: null, journal: [], erreur: null, pullRequest: null };

export class JournalActivite {
  /** `dossierAgent` : dossier de travail de l'agent pour un projet (à côté de son aperçu). */
  constructor(private readonly dossierAgent: (depot: string) => string) {}

  private fichier(depot: string, numero: number): string {
    return join(this.dossierAgent(depot), `${numero}.json`);
  }

  async lire(depot: string, numero: number): Promise<Activite> {
    try {
      return JSON.parse(await readFile(this.fichier(depot, numero), 'utf8')) as Activite;
    } catch {
      return { ...VIDE };
    }
  }

  async enregistrer(depot: string, numero: number, maj: Partial<Activite>): Promise<Activite> {
    const activite = { ...(await this.lire(depot, numero)), ...maj };
    await mkdir(this.dossierAgent(depot), { recursive: true });
    await ecrireAtomique(this.fichier(depot, numero), JSON.stringify(activite, null, 2));
    return activite;
  }

  /** Ajoute une ligne au fil d'activité (les 60 dernières sont gardées). */
  async noter(depot: string, numero: number, texte: string): Promise<void> {
    const activite = await this.lire(depot, numero);
    const journal = [...activite.journal, { le: new Date().toISOString(), texte }].slice(-60);
    await this.enregistrer(depot, numero, { journal });
  }
}
