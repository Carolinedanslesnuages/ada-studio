import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executerParDefaut } from './apercu.service.js';
import { dossierGitDe, environnementAgent, environnementGitIsole, isolerGit } from './git-isole.js';

/**
 * Vrai git : le dépôt d'un aperçu est monté dans un conteneur où l'agent lance des commandes libres.
 * Un hook posé dans son .git ne doit jamais s'exécuter sur le serveur.
 */
describe('Isolement de git (dépôt monté dans le conteneur de l’aperçu)', () => {
  const racines: string[] = [];
  afterEach(() => racines.splice(0).forEach((racine) => rmSync(racine, { recursive: true, force: true })));

  const ENV_SAIN = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', cwd, ...args], { encoding: 'utf8', env: ENV_SAIN });
  const journal = (projet: string) => execFileSync('git', ['--git-dir', join(projet, 'git'), 'log', '--oneline'], { encoding: 'utf8', env: ENV_SAIN });

  /** Projet d'aperçu à l'ancienne : `<projet>/depot/.git` est un dossier, donc visible du conteneur. */
  function projetAncien(): { projet: string; depot: string; piege: string } {
    const projet = mkdtempSync(join(tmpdir(), 'isole-'));
    racines.push(projet);
    const depot = join(projet, 'depot');
    mkdirSync(depot);
    git(depot, 'init', '-q', '-b', 'main');
    writeFileSync(join(depot, 'a.txt'), 'a');
    git(depot, 'add', '-A');
    git(depot, 'commit', '-qm', 'init');
    // Ce qu'une commande lancée dans le conteneur peut écrire : un hook qui laisse une trace sur l'hôte.
    const piege = join(projet, 'HOOK-EXECUTE-SUR-LE-SERVEUR');
    const hook = join(depot, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, `#!/bin/sh\ntouch "${piege}"\n`);
    chmodSync(hook, 0o755);
    return { projet, depot, piege };
  }

  /** Un commit comme l'API ou l'agent le font : par l'exécuteur par défaut, avec l'isolement appliqué. */
  async function nouveauCommit(depot: string, nom: string): Promise<void> {
    writeFileSync(join(depot, nom), nom);
    await executerParDefaut('git', ['-C', depot, 'add', '-A'], { env: ENV_SAIN });
    await executerParDefaut('git', ['-C', depot, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', nom], { env: ENV_SAIN });
  }

  it('témoin : sans isolement, le hook posé dans le dépôt s’exécute bel et bien', () => {
    const { depot, piege } = projetAncien();
    writeFileSync(join(depot, 'b.txt'), 'b');
    git(depot, 'add', '-A');
    git(depot, 'commit', '-qm', 'b');
    expect(existsSync(piege)).toBe(true);
  });

  it('range le .git hors du dossier monté et retire les hooks déjà posés', async () => {
    const { projet, depot, piege } = projetAncien();
    await isolerGit(depot);
    expect(statSync(join(depot, '.git')).isFile()).toBe(true);
    expect(existsSync(join(projet, 'git', 'hooks', 'pre-commit'))).toBe(false);
    await nouveauCommit(depot, 'c.txt');
    expect(existsSync(piege)).toBe(false);
    expect(journal(projet)).toContain('c.txt');
  });

  it('ignore un .git réécrit depuis le conteneur pour pointer vers un dossier git piégé', async () => {
    const { projet, depot, piege } = projetAncien();
    await isolerGit(depot);
    // Le conteneur voit le dépôt : il fabrique un dossier git piégé dans le dépôt et y renvoie le fichier .git.
    const faux = join(depot, 'faux-git');
    mkdirSync(join(faux, 'hooks'), { recursive: true });
    mkdirSync(join(faux, 'objects'));
    mkdirSync(join(faux, 'refs'));
    writeFileSync(join(faux, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(join(faux, 'hooks', 'pre-commit'), `#!/bin/sh\ntouch "${piege}"\n`);
    chmodSync(join(faux, 'hooks', 'pre-commit'), 0o755);
    writeFileSync(join(faux, 'config'), `[core]\n\trepositoryformatversion = 0\n\thooksPath = ${join(faux, 'hooks')}\n`);
    writeFileSync(join(depot, '.git'), 'gitdir: ./faux-git\n');
    await nouveauCommit(depot, 'd.txt');
    expect(existsSync(piege)).toBe(false);
    expect(journal(projet)).toContain('d.txt');
  });

  it('coupe le moniteur de fichiers même s’il est réglé dans le dossier git, sans écraser le jeton déjà passé', async () => {
    const { projet, depot } = projetAncien();
    await isolerGit(depot);
    const env = environnementGitIsole({ GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.extraheader', GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic xx' }, depot);
    expect(env).toMatchObject({
      GIT_DIR: join(projet, 'git'),
      GIT_WORK_TREE: depot,
      GIT_CONFIG_COUNT: '3',
      GIT_CONFIG_KEY_0: 'http.extraheader',
      GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic xx',
      GIT_CONFIG_KEY_1: 'core.hooksPath',
      GIT_CONFIG_VALUE_1: '/dev/null',
      GIT_CONFIG_KEY_2: 'core.fsmonitor',
      GIT_CONFIG_VALUE_2: 'false',
    });
    // fsmonitor piégé dans le dossier git : il s'exécuterait à chaque « git status ».
    const piege = join(projet, 'FSMONITOR-EXECUTE');
    const moniteur = join(projet, 'moniteur.sh');
    writeFileSync(moniteur, `#!/bin/sh\ntouch "${piege}"\n`);
    chmodSync(moniteur, 0o755);
    writeFileSync(join(projet, 'git', 'config'), `${readFileSync(join(projet, 'git', 'config'), 'utf8')}[core]\n\tfsmonitor = ${moniteur}\n`);
    await executerParDefaut('git', ['-C', depot, 'status', '--porcelain'], { env: ENV_SAIN });
    expect(existsSync(piege)).toBe(false);
  });

  it('ne change rien pour un dossier qui n’est pas un dépôt d’aperçu (ex. copie temporaire de création)', () => {
    const env = { PATH: '/bin' };
    expect(dossierGitDe('/tmp/ada-creation-x/copie')).toBeNull();
    expect(environnementGitIsole(env, '/tmp/ada-creation-x/copie')).toBe(env);
    expect(environnementGitIsole(env, join(tmpdir(), 'absent-xyz', 'depot'))).toBe(env);
  });

  it('retire de l’environnement de l’agent les secrets du serveur, et garde le reste', () => {
    const env = environnementAgent(
      { PATH: '/bin', HOME: '/h', SESSION_SECRET: 's', GITHUB_CLIENT_SECRET: 'c', GITHUB_CLIENT_ID: 'i', OBSERVE_APP_SECRET: 'o', ANTHROPIC_API_KEY: 'k' },
      '/ailleurs/depot',
    );
    expect(Object.keys(env).sort()).toEqual(['ANTHROPIC_API_KEY', 'HOME', 'PATH']);
  });
});
