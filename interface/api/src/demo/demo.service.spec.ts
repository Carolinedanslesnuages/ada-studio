import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { lireConfig } from '../config.js';
import { ApercuService, type Executer } from '../apercu/apercu.service.js';
import { DemoService } from './demo.service.js';

const JETON = 'jeton-secret-du-po';

describe('Lien de démonstration', () => {
  let racine: string;
  let apercu: ApercuService;
  let executer: ReturnType<typeof vi.fn<Executer>>;
  let service: DemoService;

  const creer = (urlDemo?: string) => {
    const config = lireConfig({
      GITHUB_PROPRIETAIRE: 'proprio',
      GITHUB_CLIENT_ID: 'Iv',
      GITHUB_CLIENT_SECRET: 's',
      SESSION_SECRET: 'x'.repeat(32),
      DOSSIER_APERCUS: racine,
      ...(urlDemo ? { URL_DEMO: urlDemo } : {}),
    });
    apercu = new ApercuService(config);
    apercu.executer = executer;
    apercu.repond = async () => true;
    service = new DemoService(config, apercu);
  };

  const demarrerApercu = () => {
    mkdirSync(join(racine, 'poc'), { recursive: true });
    writeFileSync(join(racine, 'poc', 'compose.yml'), 'services: {}\n');
  };

  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'demo-'));
    executer = vi.fn<Executer>(async (commande, args) => {
      if (commande === 'git' && args[0] === 'clone') {
        const dossierGit = args[args.indexOf('--separate-git-dir') + 1]!;
        mkdirSync(args.at(-1)!, { recursive: true });
        mkdirSync(dossierGit, { recursive: true });
        writeFileSync(join(args.at(-1)!, '.git'), `gitdir: ${dossierGit}\n`);
      }
      if (args.includes('ps')) return { stdout: JSON.stringify({ Service: 'app', State: 'running' }) };
      return { stdout: '' };
    });
    creer();
  });

  it('sans aperçu démarré : pas de lien, et ADA dit pourquoi', async () => {
    expect(await service.etat('poc')).toEqual({ etat: 'arrete', url: null, apercuDemarre: false });
    await expect(service.demarrer(JETON, 'poc')).rejects.toThrow(/Démarrez d’abord l’aperçu/);
    await expect(service.demarrer(JETON, 'poc')).rejects.toBeInstanceOf(BadRequestException);
    expect(executer).not.toHaveBeenCalled();
  });

  it('démarre une instance séparée sur main (jamais le travail en cours), avec son propre port', async () => {
    demarrerApercu();
    const demo = await service.demarrer(JETON, 'poc');
    expect(demo).toEqual({ etat: 'pret', url: 'http://localhost:5830', apercuDemarre: true });
    const clone = executer.mock.calls.find(([commande, args]) => commande === 'git' && args[0] === 'clone')!;
    expect(clone[1]).toEqual(['clone', '--quiet', '--branch', 'main', '--separate-git-dir', join(racine, 'poc', 'demo', 'git'), 'https://github.com/proprio/poc.git', join(racine, 'poc', 'demo', 'depot')]);
    expect(clone[1].join(' ')).not.toContain(JETON);
    const compose = readFileSync(join(racine, 'poc', 'demo', 'compose.yml'), 'utf8');
    expect(compose).toContain('name: ada-studio-demo-poc');
    expect(compose).toContain('"127.0.0.1:5830:');
    expect(executer).toHaveBeenCalledWith('docker', ['compose', '-f', 'compose.yml', 'up', '-d', '--remove-orphans'], { cwd: join(racine, 'poc', 'demo') });
  });

  it('donne l’adresse publique configurée et autorise cet hôte dans le serveur de développement', async () => {
    creer('https://{projet}.demo.ada.gouv.fr');
    demarrerApercu();
    expect((await service.demarrer(JETON, 'poc')).url).toBe('https://poc.demo.ada.gouv.fr');
    expect(readFileSync(join(racine, 'poc', 'demo', 'compose.yml'), 'utf8')).toContain('__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: poc.demo.ada.gouv.fr');
  });

  it('après une fusion, aligne la démo sur main et la relance ; rien si elle n’existe pas', async () => {
    await service.mettreAJour(JETON, 'poc');
    expect(executer).not.toHaveBeenCalled();
    demarrerApercu();
    await service.demarrer(JETON, 'poc');
    executer.mockClear();
    await service.mettreAJour(JETON, 'poc');
    const commandes = executer.mock.calls.map(([commande, args]) => `${commande} ${args.filter((arg) => !arg.startsWith('/')).join(' ')}`);
    expect(commandes).toEqual([
      'git -C fetch --quiet origin main',
      'git -C checkout --quiet -B main origin/main',
      'git -C reset --quiet --hard origin/main',
      'docker compose -f compose.yml restart app',
    ]);
  });
});
