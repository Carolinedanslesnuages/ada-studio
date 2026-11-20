/**
 * Skills `po-` d'ADA livrées dans chaque projet créé : le dépôt du PO porte lui-même la méthode
 * (story, signalement, nouveau projet), lisible par tout agent de code, pas seulement par celui d'ADA.
 * Dossier commun à Codex, OpenCode, Cursor, Copilot et Gemini CLI ; liens relatifs pour Claude Code.
 */
import { cp, mkdir, readdir, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';

const DOSSIER_COMMUN = '.agents/skills';
const DOSSIER_CLAUDE = '.claude/skills';

const existe = (chemin: string) => stat(chemin).then(() => true, () => false);

/**
 * Copie chaque skill de `dossierSkills` (un dossier qui contient un SKILL.md) dans `.agents/skills/`
 * et la relie depuis `.claude/skills/`. Une skill que le modèle apporte déjà est laissée telle quelle.
 * Un dossier de skills absent ne bloque pas la création : le projet est livré sans.
 * Renvoie les noms des skills ajoutées.
 */
export async function ajouterSkillsPo(copie: string, dossierSkills: string | null): Promise<string[]> {
  if (!dossierSkills || !(await existe(dossierSkills))) return [];
  const ajoutees: string[] = [];
  for (const nom of (await readdir(dossierSkills)).sort()) {
    const source = join(dossierSkills, nom);
    if (!(await existe(join(source, 'SKILL.md')))) continue;
    const cible = join(copie, DOSSIER_COMMUN, nom);
    if (await existe(cible)) continue;
    await cp(source, cible, { recursive: true, filter: (chemin) => !chemin.endsWith('.DS_Store') });
    await mkdir(join(copie, DOSSIER_CLAUDE), { recursive: true });
    await symlink(`../../${DOSSIER_COMMUN}/${nom}`, join(copie, DOSSIER_CLAUDE, nom));
    ajoutees.push(nom);
  }
  return ajoutees;
}
