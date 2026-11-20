import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cheminsReserves } from './outils.js';
import { fichiersModifies } from './fichiers-modifies.js';

/** Vrai dépôt git (pas une sortie simulée) : c'est le comportement de git qui est en cause. */
describe('Fichiers modifiés par une branche (garde-fou des dossiers réservés)', () => {
  const dossiers: string[] = [];
  afterEach(() => dossiers.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', cwd, ...args], { encoding: 'utf8' });
  const executer = async (commande: string, args: string[]) => ({ stdout: execFileSync(commande, args, { encoding: 'utf8' }) });

  function depot(): string {
    const cwd = mkdtempSync(join(tmpdir(), 'garde-fou-'));
    dossiers.push(cwd);
    git(cwd, 'init', '-q', '-b', 'main');
    mkdirSync(join(cwd, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(cwd, '.github', 'workflows', 'ci.yml'), 'name: ci\non: pull_request\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'init');
    git(cwd, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(cwd, 'checkout', '-q', '-b', 'story/1');
    return cwd;
  }

  it('voit la CI supprimée quand elle est déplacée hors de .github/ (git mv)', async () => {
    const cwd = depot();
    mkdirSync(join(cwd, 'docs'));
    git(cwd, 'mv', '.github/workflows/ci.yml', 'docs/ci.yml');
    git(cwd, 'commit', '-qm', 'feat: x');
    const fichiers = await fichiersModifies(executer, cwd, 'story/1');
    expect(fichiers).toContain('.github/workflows/ci.yml');
    expect(cheminsReserves(fichiers)).toEqual(['.github/workflows/ci.yml']);
  });

  it('ne signale rien pour une modification ordinaire', async () => {
    const cwd = depot();
    writeFileSync(join(cwd, 'page.txt'), 'bonjour');
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-qm', 'feat: page');
    expect(cheminsReserves(await fichiersModifies(executer, cwd, 'story/1'))).toEqual([]);
  });
});
