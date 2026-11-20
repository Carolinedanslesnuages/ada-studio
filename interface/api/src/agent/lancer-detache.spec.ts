import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lancerDetache } from './lancement.js';

describe('travailleur lancé hors de l’arbre de processus de l’API', () => {
  it('n’est pas un descendant de l’API : un redémarrage de l’API ne l’interrompt pas', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'detache-'));
    const script = join(dossier, 'travailleur.cjs');
    // Le « travailleur » note son pid et celui de son parent, une fois l'intermédiaire terminé.
    writeFileSync(
      script,
      `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(join(dossier, 'parent'))}, JSON.stringify({ pid: process.pid, parent: process.ppid, tache: process.argv[2] })), 300);`,
    );
    const pid = await lancerDetache(script, 'tache.json', join(dossier, 'journal.log'));
    await new Promise((fin) => setTimeout(fin, 1000));
    const releve = JSON.parse(readFileSync(join(dossier, 'parent'), 'utf8')) as { pid: number; parent: number; tache: string };
    expect(releve.pid).toBe(pid);
    expect(releve.tache).toBe('tache.json');
    expect(releve.parent).not.toBe(process.pid);
  });
});
