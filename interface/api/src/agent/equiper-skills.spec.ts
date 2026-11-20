import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { lireConfig } from '../config.js';
import { equiperSkills } from './equiper-skills.js';

describe('Skills reliées au projet de l’agent', () => {
  let racine: string;

  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'agent-'));
  });

  it('équipe de ses skills un projet dont le dossier git est rangé hors du dépôt (.git réduit à un fichier), sans rien laisser à commiter', async () => {
    const { execFileSync } = await import('node:child_process');
    const { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } = await import('node:fs');
    const { isolerGit } = await import('../apercu/git-isole.js');
    const { executerParDefaut } = await import('../apercu/apercu.service.js');
    const catalogue = join(racine, 'catalogue');
    mkdirSync(join(catalogue, 'methode-exemple'), { recursive: true });
    writeFileSync(join(catalogue, 'methode-exemple', 'SKILL.md'), '---\nname: methode-exemple\n---\n');
    // Un vrai dépôt d'aperçu, migré : <projet>/git est le dossier git, <projet>/depot/.git un simple fichier.
    const depot = join(racine, 'gladys', 'depot');
    mkdirSync(depot, { recursive: true });
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
    execFileSync('git', ['-C', depot, 'init', '-q', '-b', 'main'], { env });
    writeFileSync(join(depot, 'a.txt'), 'a');
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', depot, 'add', '-A'], { env });
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', depot, 'commit', '-qm', 'init'], { env });
    await isolerGit(depot);
    expect(statSync(join(depot, '.git')).isFile()).toBe(true);
    const skills = lireConfig({ GITHUB_PROPRIETAIRE: 'proprio', GITHUB_CLIENT_ID: 'Iv', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: 'x'.repeat(32), AGENT_COMMANDE: '/bin/agent', AGENT_SKILLS: join(catalogue, 'methode-exemple') }).AGENT_SKILLS;
    const equipe = { equiperSkills: (cwd: string) => equiperSkills(cwd, skills, () => undefined) };
    expect((await equipe.equiperSkills(depot)).noms).toEqual(['methode-exemple']);
    expect(existsSync(join(depot, '.claude', 'skills', 'methode-exemple'))).toBe(true);
    // Les exclusions vont dans le vrai dossier git, et git ne voit pas les skills reliées.
    expect(readFileSync(join(racine, 'gladys', 'git', 'info', 'exclude'), 'utf8')).toContain('/.claude/skills/');
    const { stdout } = await executerParDefaut('git', ['-C', depot, 'status', '--porcelain'], { env });
    expect(stdout).toBe('');
  });

  describe('skills apportées par le dépôt lui-même (projet repris, fichiers passés dans une PR)', () => {
    const preparer = async (skillDuDepot: { nom: string; contenu: string }) => {
      const { mkdirSync, writeFileSync } = await import('node:fs');
      const catalogue = join(racine, 'catalogue');
      mkdirSync(join(catalogue, 'methode-exemple'), { recursive: true });
      writeFileSync(join(catalogue, 'methode-exemple', 'SKILL.md'), '---\nname: methode-exemple\n---\n');
      const projet = join(racine, 'projet');
      mkdirSync(join(projet, '.git', 'info'), { recursive: true });
      mkdirSync(join(projet, '.claude', 'skills', skillDuDepot.nom), { recursive: true });
      writeFileSync(join(projet, '.claude', 'skills', skillDuDepot.nom, 'SKILL.md'), skillDuDepot.contenu);
      const avertissements: string[] = [];
      return { projet, skills: [join(catalogue, 'methode-exemple')], avertissements, avertir: (message: string) => avertissements.push(message) };
    };

    it('refuse de travailler avec une skill du dépôt qui pré-autorise des outils ou exécute des commandes', async () => {
      const { projet, skills, avertir } = await preparer({ nom: 'deploiement', contenu: '---\nname: deploiement\nallowed-tools: Bash(*)\n---\nDéploie.' });
      await expect(equiperSkills(projet, skills, avertir)).rejects.toThrow(/skill « deploiement » qui pré-autorise des outils ou exécute des commandes/);
    });

    it('ne relie pas une skill d’ADA qu’un dossier du dépôt du même nom remplacerait, et ne la cite pas à l’agent', async () => {
      const { lstatSync } = await import('node:fs');
      const { projet, skills, avertissements, avertir } = await preparer({ nom: 'methode-exemple', contenu: '---\nname: methode-exemple\n---\nMa version.' });
      expect(await equiperSkills(projet, skills, avertir)).toEqual({ noms: [], dossiers: [] });
      expect(lstatSync(join(projet, '.claude', 'skills', 'methode-exemple')).isDirectory()).toBe(true);
      expect(avertissements.join('\n')).toMatch(/methode-exemple d'ADA masquée/);
    });

    it('laisse une skill du dépôt sûre, sous un autre nom, à côté de celles d’ADA', async () => {
      const { projet, skills, avertir } = await preparer({ nom: 'metier', contenu: '---\nname: metier\n---\nRègles métier.' });
      expect((await equiperSkills(projet, skills, avertir)).noms).toEqual(['methode-exemple']);
    });
  });

  it('équipe le projet des skills configurées, sans rien laisser à commiter', async () => {
    const { mkdirSync, writeFileSync, readFileSync, lstatSync, readlinkSync, realpathSync, existsSync } = await import('node:fs');
    const catalogue = join(racine, 'catalogue');
    for (const nom of ['methode-exemple', 'repo-perimetre']) {
      mkdirSync(join(catalogue, nom), { recursive: true });
      writeFileSync(join(catalogue, nom, 'SKILL.md'), `---\nname: ${nom}\n---\n`);
    }
    const projet = join(racine, 'projet');
    mkdirSync(join(projet, '.git', 'info'), { recursive: true });
    writeFileSync(join(projet, '.git', 'info', 'exclude'), '# exclusions locales\n');
    const skills = lireConfig({ GITHUB_PROPRIETAIRE: 'proprio', GITHUB_CLIENT_ID: 'Iv', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: 'x'.repeat(32), AGENT_COMMANDE: '/bin/agent', AGENT_SKILLS: `${join(catalogue, 'methode-exemple')}, ${join(catalogue, 'repo-perimetre')}, ${join(catalogue, 'absente')}, ${join(catalogue, 'adr-new')}` }).AGENT_SKILLS;
    const equipe = { equiperSkills: (cwd: string) => equiperSkills(cwd, skills, () => undefined) };
    mkdirSync(join(catalogue, 'adr-new'), { recursive: true });
    writeFileSync(join(catalogue, 'adr-new', 'SKILL.md'), '---\nname: adr-new\nallowed-tools: Read Write\n---\n');
    const attendu = { noms: ['methode-exemple', 'repo-perimetre'], dossiers: [realpathSync(join(catalogue, 'methode-exemple')), realpathSync(join(catalogue, 'repo-perimetre'))] };
    expect(await equipe.equiperSkills(projet)).toEqual(attendu);
    expect(await equipe.equiperSkills(projet)).toEqual(attendu);
    expect(existsSync(join(projet, '.claude/skills/adr-new'))).toBe(false);
    for (const racineSkills of ['.claude/skills', '.agents/skills']) {
      const lien = join(projet, racineSkills, 'methode-exemple');
      expect(lstatSync(lien).isSymbolicLink()).toBe(true);
      expect(readlinkSync(lien)).toBe(join(catalogue, 'methode-exemple'));
    }
    const exclusions = readFileSync(join(projet, '.git', 'info', 'exclude'), 'utf8');
    expect(exclusions.match(/^\/\.claude\/skills\/$/gm)).toHaveLength(1);
    expect(exclusions).toContain('/.agents/skills/');
  });
});
