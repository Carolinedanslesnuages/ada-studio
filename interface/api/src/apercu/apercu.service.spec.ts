import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { lireConfig } from '../config.js';
import { ApercuService, DELAI_VEILLE_MS, type Executer } from './apercu.service.js';

const JETON = 'jeton-secret-du-po';

describe('ApercuService', () => {
  let racine: string;
  let service: ApercuService;
  let executer: ReturnType<typeof vi.fn<Executer>>;
  let brancheCourante = 'main';

  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'apercus-'));
    service = new ApercuService(
      lireConfig({
        GITHUB_PROPRIETAIRE: 'proprio',
        GITHUB_CLIENT_ID: 'Iv',
        GITHUB_CLIENT_SECRET: 's',
        SESSION_SECRET: 'x'.repeat(32),
        DOSSIER_APERCUS: racine,
      }),
    );
    executer = vi.fn<Executer>(async (commande, args) => {
      // Comme le vrai « git clone --separate-git-dir » : dossier git à part, et simple fichier .git dans le dépôt.
      if (commande === 'git' && args[0] === 'clone') {
        const depot = args.at(-1)!;
        const dossierGit = args[args.indexOf('--separate-git-dir') + 1]!;
        mkdirSync(depot, { recursive: true });
        mkdirSync(dossierGit, { recursive: true });
        writeFileSync(join(depot, '.git'), `gitdir: ${dossierGit}\n`);
      }
      if (args.includes('ps')) return { stdout: JSON.stringify({ Service: 'app', State: 'running' }) };
      if (args.includes('rev-parse')) return { stdout: brancheCourante + '\n' };
      return { stdout: '' };
    });
    service.executer = executer;
    service.repond = async () => true;
  });

  it('clone le dépôt avec les droits du PO, sans jamais mettre le jeton dans les arguments', async () => {
    const apercu = await service.demarrer(JETON, 'poc-portail');
    const clone = executer.mock.calls.find(([c, a]) => c === 'git' && a[0] === 'clone')!;
    // Le dossier git est rangé à côté du dépôt, hors du dossier monté dans le conteneur de l'aperçu.
    expect(clone[1]).toEqual(['clone', '--quiet', '--separate-git-dir', join(racine, 'poc-portail', 'git'), 'https://github.com/proprio/poc-portail.git', join(racine, 'poc-portail', 'depot')]);
    expect(statSync(join(racine, 'poc-portail', 'depot', '.git')).isFile()).toBe(true);
    for (const [, args] of executer.mock.calls) expect(args.join(' ')).not.toContain(JETON);
    const entete = clone[2]!.env!.GIT_CONFIG_VALUE_0!;
    expect(Buffer.from(entete.replace('AUTHORIZATION: basic ', ''), 'base64').toString()).toBe(`x-access-token:${JETON}`);
    expect(apercu).toEqual({ etat: 'pret', url: 'http://localhost:5710', journal: null });
  });

  it('écrit les fichiers des conteneurs puis les démarre', async () => {
    await service.demarrer(JETON, 'poc-portail');
    expect(readFileSync(join(racine, 'poc-portail', 'compose.yml'), 'utf8')).toContain('"127.0.0.1:5710:5173"');
    expect(existsSync(join(racine, 'poc-portail', 'demarrer.sh'))).toBe(true);
    expect(existsSync(join(racine, 'poc-portail', 'travail.sh'))).toBe(true);
    expect(executer).toHaveBeenCalledWith('docker', ['volume', 'create', 'ada-studio-cache-npm']);
    expect(executer).toHaveBeenCalledWith('docker', ['compose', '-f', 'compose.yml', 'up', '-d', '--remove-orphans'], {
      cwd: join(racine, 'poc-portail'),
    });
  });

  it('met à jour un dépôt déjà cloné (sur main) au lieu de le recloner', async () => {
    brancheCourante = 'main';
    await service.demarrer(JETON, 'poc-portail');
    executer.mockClear();
    await service.demarrer(JETON, 'poc-portail');
    expect(executer.mock.calls.some(([c, a]) => c === 'git' && a.includes('fetch'))).toBe(true);
    expect(executer.mock.calls.some(([c, a]) => c === 'git' && a.includes('origin/main'))).toBe(true);
    expect(executer.mock.calls.some(([c, a]) => c === 'git' && a[0] === 'clone')).toBe(false);
  });

  it('ne touche pas au travail en cours quand le dépôt est sur une branche de story', async () => {
    await service.demarrer(JETON, 'poc-portail');
    brancheCourante = 'story/1-accueil';
    executer.mockClear();
    await service.demarrer(JETON, 'poc-portail');
    expect(executer.mock.calls.some(([c, a]) => c === 'git' && a.includes('fetch'))).toBe(true);
    expect(executer.mock.calls.some(([c, a]) => c === 'git' && a.includes('origin/main'))).toBe(false);
    brancheCourante = 'main';
  });

  it('donne un port différent à chaque projet, et le garde', async () => {
    await service.demarrer(JETON, 'poc-portail');
    const autre = await service.demarrer(JETON, 'annuaire');
    expect(autre.url).toBe('http://localhost:5711');
    expect((await service.demarrer(JETON, 'poc-portail')).url).toBe('http://localhost:5710');
  });

  it('est « arrêté » tant qu’il n’a jamais été démarré', async () => {
    expect(await service.etat('jamais-lance')).toEqual({ etat: 'arrete', url: null, journal: null });
  });

  it('reste « en démarrage » tant que l’application ne répond pas', async () => {
    service.repond = async () => false;
    const apercu = await service.demarrer(JETON, 'poc-portail');
    expect(apercu.etat).toBe('demarrage');
    expect(apercu.url).toBeNull();
  });

  it('refuse un nom de projet qui sortirait du dossier des aperçus', async () => {
    await expect(service.demarrer(JETON, '../etc')).rejects.toBeInstanceOf(BadRequestException);
    expect(executer).not.toHaveBeenCalled();
  });

  it('explique simplement un échec de démarrage, sans détail technique', async () => {
    executer.mockRejectedValueOnce(new Error('fatal: could not read from remote repository'));
    await expect(service.demarrer(JETON, 'poc-portail')).rejects.toThrow(/L’aperçu n’a pas pu démarrer/);
  });

  describe('relance de l’application après un changement de branche', () => {
    const ecrireProjet = (adaJson: string | null) => {
      const dossier = join(racine, 'poc');
      mkdirSync(join(dossier, 'depot'), { recursive: true });
      writeFileSync(join(dossier, 'compose.yml'), 'services: {}\n');
      if (adaJson) writeFileSync(join(dossier, 'depot', 'ada.json'), adaJson);
    };

    it('redémarre le conteneur de l’application quand elle a une API en arrière-plan', async () => {
      ecrireProjet(null); // sans ada.json : modèle Vue + NestJS, API en arrière-plan
      await service.relancerApplication('poc');
      expect(executer).toHaveBeenCalledWith('docker', ['compose', '-f', 'compose.yml', 'restart', 'app'], { cwd: join(racine, 'poc') });
    });

    it('redémarre aussi une application sans arrière-plan : le rechargement à chaud de Vite garde parfois d’anciens modules', async () => {
      ecrireProjet(JSON.stringify({ type: 'maquette', edition: 'studio', controlesRequis: ['x'], controles: ['y'], apercu: { principal: 'npx vite' } }));
      await service.relancerApplication('poc');
      expect(executer).toHaveBeenCalledWith('docker', ['compose', '-f', 'compose.yml', 'restart', 'app'], { cwd: join(racine, 'poc') });
    });

    it('ne réveille pas un aperçu en veille pour le relancer', async () => {
      ecrireProjet(null);
      writeFileSync(join(racine, 'poc', 'en-veille'), '');
      await service.relancerApplication('poc');
      expect(executer).not.toHaveBeenCalled();
    });

    it('ne fait rien si l’aperçu n’a jamais été démarré', async () => {
      await service.relancerApplication('poc');
      expect(executer).not.toHaveBeenCalled();
    });
  });

  describe('mise en veille des aperçus inutilisés', () => {
    const apercuDemarre = (projet: string) => {
      mkdirSync(join(racine, projet), { recursive: true });
      writeFileSync(join(racine, projet, 'compose.yml'), 'services: {}');
    };
    const arrets = () => executer.mock.calls.filter(([, a]) => a.includes('stop')).map(([, , o]) => o?.cwd);

    it('arrête un aperçu inutilisé depuis le délai, garde ceux qui servent', async () => {
      apercuDemarre('ancien');
      apercuDemarre('recent');
      const maintenant = Date.now() + DELAI_VEILLE_MS + 1000;
      service.noterUtilisation('recent');
      (service as unknown as { utilisations: Map<string, number> }).utilisations.set('recent', maintenant - 60_000);
      expect(await service.mettreEnVeille(maintenant)).toEqual(['ancien']);
      expect(arrets()).toEqual([join(racine, 'ancien')]);
      expect(service.estEnVeille('ancien')).toBe(true);
      // Déjà en veille : rien à refaire.
      expect(await service.mettreEnVeille(maintenant + 1000)).toEqual([]);
    });

    it('n’arrête jamais l’aperçu d’un projet où un agent travaille', async () => {
      apercuDemarre('occupe');
      mkdirSync(join(racine, 'occupe', 'agent'), { recursive: true });
      writeFileSync(join(racine, 'occupe', 'agent', 'verrou.json'), JSON.stringify({ pid: process.pid, numero: 3, phase: 'realisation' }));
      expect(await service.mettreEnVeille(Date.now() + DELAI_VEILLE_MS * 2)).toEqual([]);
      expect(arrets()).toEqual([]);
    });

    it('un aperçu en veille se dit « arrêté » (pas en panne), puis redémarre à la demande', async () => {
      apercuDemarre('poc-portail');
      await service.mettreEnVeille(Date.now() + DELAI_VEILLE_MS * 2);
      expect((await service.etat('poc-portail')).etat).toBe('arrete');
      const apercu = await service.demarrer(JETON, 'poc-portail');
      expect(apercu.etat).toBe('pret');
      expect(service.estEnVeille('poc-portail')).toBe(false);
    });
  });
});
