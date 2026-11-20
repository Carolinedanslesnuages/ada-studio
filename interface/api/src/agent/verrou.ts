import { readFileSync, statSync } from 'node:fs';

/** Une tâche de l'agent tient le verrou de son projet : une seule à la fois par projet. */
export interface Verrou {
  pid: number;
  numero: number;
  phase: string;
}

/** Le processus qui tient le verrou le « touche » à cette cadence : preuve qu'il travaille toujours. */
export const BATTEMENT_VERROU_MS = 30_000;
/**
 * Sans battement depuis ce délai, le verrou est abandonné même si son numéro de processus existe
 * encore : après un redémarrage de la machine, ce numéro peut avoir été donné à un tout autre
 * processus, et le projet resterait « occupé » pour toujours.
 */
export const PEREMPTION_VERROU_MS = 4 * BATTEMENT_VERROU_MS;

export function processusVivant(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Verrou du fichier, s'il est tenu par un processus vivant qui a donné signe de vie récemment. */
export function verrouVivant(chemin: string, maintenant = Date.now()): Verrou | null {
  try {
    const verrou = JSON.parse(readFileSync(chemin, 'utf8')) as Verrou;
    if (!verrou.pid || !processusVivant(verrou.pid)) return null;
    return maintenant - statSync(chemin).mtimeMs <= PEREMPTION_VERROU_MS ? verrou : null;
  } catch {
    return null;
  }
}
