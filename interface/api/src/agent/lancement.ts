/** Lancement des processus : l'agent de code, et le travailleur détaché qui survit à l'API. */
import { spawn } from 'node:child_process';
import { rename, writeFile } from 'node:fs/promises';
import { environnementAgent } from '../apercu/git-isole.js';

/** Écriture atomique : on ne lit jamais un fichier à moitié écrit (fichier temporaire puis renommage). */
export async function ecrireAtomique(chemin: string, contenu: string): Promise<void> {
  const temporaire = `${chemin}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaire, contenu);
  await rename(temporaire, chemin);
}

/**
 * Lance le travailleur par un intermédiaire qui se termine aussitôt (« double lancement ») : le
 * travailleur n'est plus un descendant de l'API. Un redémarrage de l'API (mise à jour, mode
 * développement qui arrête tout l'arbre de processus) ne l'interrompt donc pas. Renvoie son pid.
 */
export async function lancerDetache(script: string, fichierTache: string, journal: string): Promise<number> {
  const intermediaire = `
    const { spawn } = require('node:child_process');
    const { openSync } = require('node:fs');
    const sortie = openSync(process.argv[3], 'a');
    const travailleur = spawn(process.execPath, [process.argv[1], process.argv[2]], { detached: true, stdio: ['ignore', sortie, sortie] });
    travailleur.unref();
    process.stdout.write(String(travailleur.pid));`;
  return new Promise((ok, ko) => {
    let pid = '';
    const lanceur = spawn(process.execPath, ['-e', intermediaire, script, fichierTache, journal], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'inherit'] });
    lanceur.stdout.on('data', (morceau: Buffer) => (pid += morceau.toString()));
    lanceur.on('error', ko);
    lanceur.on('close', (code) => (code === 0 && Number(pid) > 0 ? ok(Number(pid)) : ko(new Error(`Le travailleur n’a pas pu démarrer (code ${code})`))));
  });
}

/** Lance l'agent ; appelle surLigne pour chaque ligne de sa sortie ; renvoie le code de sortie. */
export type LancerAgent = (args: string[], cwd: string, surLigne: (ligne: string) => void) => Promise<number>;

export const lancerParDefaut =
  (commande: string): LancerAgent =>
  (args, cwd, surLigne) =>
    new Promise((ok, ko) => {
      // Sans les secrets du serveur, et avec git verrouillé sur le dépôt de travail (voir git-isole.ts).
      const processus = spawn(commande, args, { cwd, env: environnementAgent(process.env, cwd), stdio: ['ignore', 'pipe', 'pipe'] });
      let reste = '';
      processus.stdout.on('data', (morceau: Buffer) => {
        const lignes = (reste + morceau.toString('utf8')).split('\n');
        reste = lignes.pop() ?? '';
        lignes.filter(Boolean).forEach(surLigne);
      });
      processus.on('error', ko);
      processus.on('close', (code) => {
        if (reste) surLigne(reste);
        ok(code ?? 1);
      });
    });

/** Modèle choisi dans la configuration (AGENT_MODELE) ; sinon celui du compte de l'agent. */
export function optionModele(modele: string | undefined | null): string[] {
  return modele ? ['--model', modele] : [];
}
