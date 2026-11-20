import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { empreinte, type Empreinte, type UsageModele } from './empreinte.js';

/**
 * Journal brut de l'usage des modèles (un objet JSON par ligne, hors git, dans le dossier du
 * registre) : seulement des tokens par modèle, jamais de contenu. L'API et les travailleurs y
 * ajoutent chacun leurs lignes.
 */
export interface EntreeEmpreinte {
  le: string;
  projet: string;
  numero: number;
  phase: string;
  /**
   * Session reprise de l'agent (conversation) : Claude y rapporte le TOTAL DE LA SESSION à chaque
   * tour, pas l'usage du tour. On garde le relevé brut ; le calcul n'en retient que la différence.
   */
  session?: string | null;
  usages: UsageModele[];
}

const fichier = (dossierRegistre: string) => join(resolve(dossierRegistre), 'empreinte.jsonl');

export async function noterEmpreinte(dossierRegistre: string, entree: EntreeEmpreinte): Promise<void> {
  if (!entree.usages.length) return;
  await mkdir(resolve(dossierRegistre), { recursive: true });
  await appendFile(fichier(dossierRegistre), `${JSON.stringify(entree)}\n`);
}

export async function lireEmpreintes(dossierRegistre: string): Promise<EntreeEmpreinte[]> {
  const texte = await readFile(fichier(dossierRegistre), 'utf8').catch(() => '');
  return texte
    .split('\n')
    .filter(Boolean)
    .flatMap((ligne) => {
      try {
        return [JSON.parse(ligne) as EntreeEmpreinte];
      } catch {
        return [];
      }
    });
}

/**
 * Usage propre à chaque entrée : pour une session reprise, le relevé moins le précédent de la même
 * session (par modèle) ; sinon le relevé tel quel. Les entrées sont lues dans l'ordre du journal.
 */
export function usagesDuTour(entrees: EntreeEmpreinte[]): UsageModele[][] {
  const derniers = new Map<string, Map<string, UsageModele>>();
  return entrees.map((entree) => {
    if (!entree.session) return entree.usages;
    const precedent = derniers.get(entree.session) ?? new Map<string, UsageModele>();
    const tour = entree.usages.map((usage) => {
      const avant = precedent.get(usage.modele);
      return {
        modele: usage.modele,
        tokensEntree: Math.max(0, usage.tokensEntree - (avant?.tokensEntree ?? 0)),
        tokensSortie: Math.max(0, usage.tokensSortie - (avant?.tokensSortie ?? 0)),
      };
    });
    derniers.set(entree.session, new Map(entree.usages.map((usage) => [usage.modele, usage])));
    return tour;
  });
}

/**
 * Empreinte d'un ensemble d'entrées (toutes, un projet, une demande). Les différences de session se
 * calculent sur le journal complet, puis on ne garde que les entrées demandées.
 */
export function sommer(entrees: EntreeEmpreinte[], garder: (entree: EntreeEmpreinte) => boolean = () => true): Empreinte {
  const tours = usagesDuTour(entrees);
  return empreinte(entrees.flatMap((entree, rang) => (garder(entree) ? tours[rang]! : [])));
}
