import type { Executer } from '../apercu/apercu.service.js';

/**
 * Fichiers touchés par la branche depuis main, anciens chemins des fichiers déplacés compris :
 * sans `--no-renames`, `git mv .github/workflows/ci.yml docs/ci.yml` n'afficherait que `docs/ci.yml`
 * et le garde-fou des dossiers réservés ne verrait pas que la CI a disparu.
 */
export async function fichiersModifies(executer: Executer, cwd: string, branche: string): Promise<string[]> {
  const { stdout } = await executer('git', ['-C', cwd, 'diff', '--name-only', '--no-renames', `origin/main...${branche}`]);
  return stdout.split('\n').filter(Boolean);
}
