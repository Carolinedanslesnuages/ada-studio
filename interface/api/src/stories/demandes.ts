import { Inject, Injectable } from '@nestjs/common';
import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CONFIG, type Config } from '../config.js';
import { lireIdentifiant } from '../projets/depot.js';
import { STATUTS, type ContenuBug, type ContenuStory, type Statut, type TypeDemande } from './story.js';

/**
 * L'état d'une demande vit dans ADA, pas dans GitHub. Sur GitHub, n'importe qui qui a des droits
 * sur le dépôt peut écrire un commentaire, changer un label ou éditer une issue, et ADA écrit avec
 * le jeton du PO : rien ne distingue un message d'ADA d'un message écrit à la main. ADA garde donc
 * elle-même ce qui compte pour décider ce qu'elle fait :
 *  - la demande telle qu'elle était au lancement (« figée ») : l'agent ne lit jamais l'issue vivante ;
 *  - le journal de ce qu'ADA et le PO se sont dit par l'interface (jamais relu depuis GitHub) ;
 *  - le statut (jamais relu depuis les labels).
 * GitHub reçoit une copie de lecture (commentaires, labels) et le résultat : branches et PR.
 *
 * Fichiers sous `apercus/<projet>/demandes/` (hors git). Le journal est un fichier où l'on ne fait
 * qu'ajouter des lignes : l'API et le travailleur peuvent y écrire sans se marcher dessus.
 * Ce module est le seul à connaître ce stockage : une base de données le remplacerait sans toucher le reste.
 */
export interface DemandeFigee {
  numero: number;
  titre: string;
  type: TypeDemande;
  contenu: ContenuStory | null;
  contenuBug: ContenuBug | null;
  contenuLibre: string | null;
  parent: number | null;
  lanceeLe: string;
  lanceePar: string;
}

/** Un message échangé par l'interface d'ADA, tel qu'il a été publié (texte exact, marqueur d'ADA compris). */
export interface MessageJournal {
  id: number;
  auteur: string;
  texte: string;
  le: string;
}

const STATUTS_CONNUS = new Set<string>(['nouvelle', 'livree', ...Object.keys(STATUTS)]);

@Injectable()
export class DemandesStore {
  constructor(@Inject(CONFIG) private readonly config: Pick<Config, 'DOSSIER_APERCUS' | 'GITHUB_PROPRIETAIRE'>) {}

  private dossier(depot: string): string {
    lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE); // identifiant bien formé : jamais un chemin
    return join(resolve(this.config.DOSSIER_APERCUS), depot.toLowerCase(), 'demandes');
  }

  private fichier(depot: string, numero: number, suffixe: string): string {
    if (!Number.isInteger(numero) || numero < 1) throw new Error(`Numéro de demande invalide : ${numero}`);
    return join(this.dossier(depot), `${numero}.${suffixe}`);
  }

  private async ecrireAtomique(chemin: string, contenu: string): Promise<void> {
    await mkdir(join(chemin, '..'), { recursive: true });
    const temporaire = `${chemin}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaire, contenu);
    await rename(temporaire, chemin);
  }

  private async lireJson<T>(chemin: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(chemin, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  // ---- La demande figée au lancement --------------------------------------------------------------

  async lireFigee(depot: string, numero: number): Promise<DemandeFigee | null> {
    return this.lireJson<DemandeFigee>(this.fichier(depot, numero, 'demande.json'));
  }

  /** Fige la demande. Un nouveau lancement (demande remise en attente) la remplace ; le journal, lui, se prolonge. */
  async figer(depot: string, demande: DemandeFigee): Promise<void> {
    await this.ecrireAtomique(this.fichier(depot, demande.numero, 'demande.json'), JSON.stringify(demande, null, 2));
  }

  // ---- Le journal des échanges ------------------------------------------------------------------

  async ajouterMessage(depot: string, numero: number, message: { auteur: string; texte: string }): Promise<void> {
    const chemin = this.fichier(depot, numero, 'echanges.jsonl');
    await mkdir(join(chemin, '..'), { recursive: true });
    await appendFile(chemin, `${JSON.stringify({ ...message, le: new Date().toISOString() })}\n`);
  }

  /** Les messages dans l'ordre ; `id` est leur rang (1, 2, 3…). Journal absent : liste vide. */
  async messages(depot: string, numero: number): Promise<MessageJournal[]> {
    const texte = await readFile(this.fichier(depot, numero, 'echanges.jsonl'), 'utf8').catch(() => '');
    const messages: MessageJournal[] = [];
    for (const ligne of texte.split('\n').filter(Boolean)) {
      try {
        const { auteur, texte: contenu, le } = JSON.parse(ligne) as Omit<MessageJournal, 'id'>;
        if (typeof contenu === 'string') messages.push({ id: messages.length + 1, auteur: String(auteur ?? 'inconnu'), texte: contenu, le: String(le ?? '') });
      } catch {
        // ligne abîmée (écriture interrompue) : ignorée
      }
    }
    return messages;
  }

  /** Le journal existe pour cette demande : ADA y a déjà écrit (ou l'a repris de GitHub). */
  async aUnJournal(depot: string, numero: number): Promise<boolean> {
    return (await this.messages(depot, numero)).length > 0;
  }

  // ---- Le statut --------------------------------------------------------------------------------

  async lireStatut(depot: string, numero: number): Promise<Statut | null> {
    const lu = await this.lireJson<{ statut?: string }>(this.fichier(depot, numero, 'statut.json'));
    return lu?.statut && STATUTS_CONNUS.has(lu.statut) ? (lu.statut as Statut) : null;
  }

  async ecrireStatut(depot: string, numero: number, statut: Statut): Promise<void> {
    await this.ecrireAtomique(this.fichier(depot, numero, 'statut.json'), JSON.stringify({ statut, le: new Date().toISOString() }));
  }

  /** Demande livrée ou abandonnée : plus de statut en cours. */
  async effacerStatut(depot: string, numero: number): Promise<void> {
    await rm(this.fichier(depot, numero, 'statut.json'), { force: true });
  }

  // ---- Reprise des statuts déjà posés sur GitHub avant ce changement ----------------------------

  /** Les statuts lus sur les labels GitHub ont déjà été repris une fois pour ce projet. */
  async statutsRepris(depot: string): Promise<boolean> {
    return (await this.lireJson<{ reprisLe: string }>(join(this.dossier(depot), 'statuts-repris.json'))) !== null;
  }

  async marquerStatutsRepris(depot: string): Promise<void> {
    await this.ecrireAtomique(join(this.dossier(depot), 'statuts-repris.json'), JSON.stringify({ reprisLe: new Date().toISOString() }));
  }
}
