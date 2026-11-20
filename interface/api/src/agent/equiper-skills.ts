import { existsSync } from 'node:fs';
import { appendFile, lstat, mkdir, readdir, readFile, realpath, symlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { dossierGitDe } from '../apercu/git-isole.js';
import { skillSure } from './outils.js';

const RACINES_SKILLS = ['.claude/skills', '.agents/skills'];

/**
 * Skills que le dépôt apporte lui-même (projet repris, ou fichiers passés dans une PR) : tout ce
 * qui, dans `.claude/skills` ou `.agents/skills`, n'est pas un lien vers une skill d'ADA. Elles
 * sont chargées par l'agent comme les nôtres, donc soumises au même contrôle : une skill qui
 * pré-autorise des outils ou exécute des commandes casserait le cloisonnement, et la demande est
 * refusée. Une skill du dépôt qui porte le nom d'une skill d'ADA prendrait sa place sans qu'on le
 * voie : ADA ne la relie pas et ne la cite pas à l'agent.
 */
async function skillsDuDepot(cwd: string, skillsAda: string[]): Promise<{ nom: string; chemin: string; contenu: string | null }[]> {
  const cibles = new Set(skillsAda);
  const trouvees: { nom: string; chemin: string; contenu: string | null }[] = [];
  for (const racine of RACINES_SKILLS) {
    const entrees = await readdir(join(cwd, racine)).catch(() => [] as string[]);
    for (const nom of entrees) {
      const chemin = join(cwd, racine, nom);
      const etat = await lstat(chemin).catch(() => null);
      if (!etat) continue;
      if (etat.isSymbolicLink() && cibles.has(await realpath(chemin).catch(() => ''))) continue;
      trouvees.push({ nom, chemin, contenu: await readFile(join(chemin, 'SKILL.md'), 'utf8').catch(() => null) });
    }
  }
  return trouvees;
}

/**
 * Relie les skills configurées dans le projet (.claude/skills pour Claude Code, .agents/skills
 * pour les autres agents), exclues localement de git : rien n'est commité, le dépôt reste propre.
 * Renvoie les noms des skills disponibles.
 */
export async function equiperSkills(cwd: string, skills: string[], avertir: (message: string) => void): Promise<{ noms: string[]; dossiers: string[] }> {
  const disponibles: string[] = [];
  for (const dossier of skills) {
    const contenu = await readFile(join(dossier, 'SKILL.md'), 'utf8').catch(() => null);
    if (contenu === null) continue;
    if (!skillSure(contenu)) {
      avertir(`Skill ${basename(dossier)} écartée : elle pré-autorise des outils ou exécute des commandes`);
      continue;
    }
    disponibles.push(dossier);
  }
  // Chemins réels : l'agent lit la skill via le lien, mais la permission porte sur la cible.
  const reelles = await Promise.all(disponibles.map((dossier) => realpath(dossier)));

  const duDepot = await skillsDuDepot(cwd, reelles);
  const dangereuse = duDepot.find((skill) => skill.contenu !== null && !skillSure(skill.contenu));
  if (dangereuse) {
    throw new Error(`Le projet contient une skill « ${dangereuse.nom} » qui pré-autorise des outils ou exécute des commandes : ADA ne travaille pas avec. Un développeur doit la retirer ou la corriger.`);
  }
  const masquees = new Set(duDepot.map((skill) => skill.nom));
  for (const nom of masquees) {
    if (disponibles.some((dossier) => basename(dossier) === nom)) avertir(`Skill ${nom} d'ADA masquée par un dossier du projet : non reliée, non citée à l'agent`);
  }
  const reliees = disponibles.filter((dossier) => !masquees.has(basename(dossier)));
  if (!reliees.length) return { noms: [], dossiers: [] };

  // Le dossier git d'un aperçu est rangé à côté du dépôt (`.git` n'y est qu'un fichier de renvoi,
  // voir git-isole.ts) : c'est là que git lit ses exclusions locales.
  const dossierGit = dossierGitDe(cwd);
  const exclusion = join(dossierGit && existsSync(dossierGit) ? dossierGit : join(cwd, '.git'), 'info', 'exclude');
  const exclus = await readFile(exclusion, 'utf8').catch(() => '');
  const aAjouter = RACINES_SKILLS.map((racine) => `/${racine}/`).filter((motif) => !exclus.split('\n').includes(motif));
  if (aAjouter.length) {
    await mkdir(dirname(exclusion), { recursive: true });
    await appendFile(exclusion, `${exclus && !exclus.endsWith('\n') ? '\n' : ''}${aAjouter.join('\n')}\n`);
  }
  for (const racine of RACINES_SKILLS) {
    await mkdir(join(cwd, racine), { recursive: true });
    for (const dossier of reliees) {
      const lien = join(cwd, racine, basename(dossier));
      const existant = await lstat(lien).catch(() => null);
      if (!existant) await symlink(resolve(dossier), lien);
    }
  }
  return {
    noms: reliees.map((dossier) => basename(dossier)),
    dossiers: await Promise.all(reliees.map((dossier) => realpath(dossier))),
  };
}
