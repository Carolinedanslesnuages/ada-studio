import { describe, expect, it } from 'vitest';
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ajouterSkillsPo } from './skills-projet.js';

async function avecDossiers(corps: (adaSkills: string, projet: string) => Promise<void>) {
  const racine = await mkdtemp(join(tmpdir(), 'ada-skills-'));
  const adaSkills = join(racine, 'skills-po');
  const projet = join(racine, 'projet');
  await mkdir(adaSkills, { recursive: true });
  await mkdir(projet, { recursive: true });
  try {
    await corps(adaSkills, projet);
  } finally {
    await rm(racine, { recursive: true, force: true });
  }
}

async function ecrire(chemin: string, contenu: string) {
  await mkdir(join(chemin, '..'), { recursive: true });
  await writeFile(chemin, contenu);
}

describe('skills po- livrées dans un projet créé', () => {
  it('copie chaque skill avec ses références dans .agents/skills et la relie depuis .claude/skills', async () => {
    await avecDossiers(async (adaSkills, projet) => {
      await ecrire(join(adaSkills, 'po-story', 'SKILL.md'), '---\nname: po-story\n---\n');
      await ecrire(join(adaSkills, 'po-story', 'references', 'rgaa.md'), 'grille');
      await ecrire(join(adaSkills, 'po-bug', 'SKILL.md'), '---\nname: po-bug\n---\n');

      expect(await ajouterSkillsPo(projet, adaSkills)).toEqual(['po-bug', 'po-story']);

      expect(await readFile(join(projet, '.agents/skills/po-story/references/rgaa.md'), 'utf8')).toBe('grille');
      const lien = join(projet, '.claude/skills/po-story');
      expect((await lstat(lien)).isSymbolicLink()).toBe(true);
      expect(await readlink(lien)).toBe('../../.agents/skills/po-story');
      expect(await readFile(join(lien, 'SKILL.md'), 'utf8')).toContain('po-story');
    });
  });

  it('ignore ce qui n’est pas une skill (catalogue index.json, dossier sans SKILL.md)', async () => {
    await avecDossiers(async (adaSkills, projet) => {
      await ecrire(join(adaSkills, 'index.json'), '[]');
      await ecrire(join(adaSkills, 'brouillon', 'notes.md'), 'rien');
      await ecrire(join(adaSkills, 'po-bug', 'SKILL.md'), 'ok');

      expect(await ajouterSkillsPo(projet, adaSkills)).toEqual(['po-bug']);
      await expect(lstat(join(projet, '.agents/skills/brouillon'))).rejects.toThrow();
      await expect(lstat(join(projet, '.agents/skills/index.json'))).rejects.toThrow();
    });
  });

  it('laisse telle quelle une skill que le modèle apporte déjà', async () => {
    await avecDossiers(async (adaSkills, projet) => {
      await ecrire(join(adaSkills, 'po-bug', 'SKILL.md'), 'version d’ADA');
      await ecrire(join(projet, '.agents/skills/po-bug/SKILL.md'), 'version du modèle');

      expect(await ajouterSkillsPo(projet, adaSkills)).toEqual([]);
      expect(await readFile(join(projet, '.agents/skills/po-bug/SKILL.md'), 'utf8')).toBe('version du modèle');
    });
  });

  it('ne bloque pas la création quand le dossier des skills est absent ou non configuré', async () => {
    await avecDossiers(async (adaSkills, projet) => {
      expect(await ajouterSkillsPo(projet, join(adaSkills, 'inexistant'))).toEqual([]);
      expect(await ajouterSkillsPo(projet, null)).toEqual([]);
    });
  });
});
