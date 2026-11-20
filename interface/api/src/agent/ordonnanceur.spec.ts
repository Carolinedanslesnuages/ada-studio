import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ConflictException } from '@nestjs/common';
import type { ApercuService } from '../apercu/apercu.service.js';
import type { GithubService } from '../github/github.service.js';
import type { StoriesService } from '../stories/stories.service.js';
import type { ProjetsService } from '../projets/projets.service.js';
import { verrouVivant } from './verrou.js';
import { AgentService } from './agent.service.js';
import { config, type FauxApercu, JETON, preparerBanc, projets, resultat } from './agent.banc.js';
import type { LancerAgent } from './lancement.js';

describe('AgentService — un agent par projet, une file d’attente sur la machine', () => {
  let racine: string;
  let stories: ReturnType<typeof preparerBanc>['stories'];
  let apercu: FauxApercu;
  let gh: ReturnType<typeof preparerBanc>['gh'];
  let service: AgentService;
  let lancer: ReturnType<typeof preparerBanc>['lancer'];
  let sortie: string[];
  let statut: string;
  let commits = '1';

  beforeEach(() => {
    statut = 'en-cours';
    commits = '1';
    sortie = [];
    ({ racine, stories, apercu, gh, service, lancer } = preparerBanc({ sortie: () => sortie, statut: () => statut, changerStatut: (nouveau) => (statut = nouveau), commits: () => commits }));
  });

  it('ne lance pas deux tâches en même temps sur un projet', async () => {
    let terminer: ((code: number) => void) | null = null;
    service.lancerAgent = () => new Promise((ok) => (terminer = ok));
    await service.analyser(JETON, 'poc', 1);
    await expect(service.analyser(JETON, 'poc', 2)).rejects.toThrow(ConflictException);
    expect((await service.verrouActif('poc'))?.numero).toBe(1);
    await vi.waitFor(() => expect(terminer).not.toBeNull());
    terminer!(0);
    await service.derniereTache;
    expect(await service.verrouActif('poc')).toBeNull();
  });

  it('deux lancements simultanés : une seule tâche démarre', async () => {
    let terminer: ((code: number) => void) | null = null;
    service.lancerAgent = () => new Promise((ok) => (terminer = ok));
    const resultats = await Promise.allSettled([service.analyser(JETON, 'poc', 1), service.analyser(JETON, 'poc', 2)]);
    expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultats.filter((r) => r.status === 'rejected' && r.reason instanceof ConflictException)).toHaveLength(1);
    await vi.waitFor(() => expect(terminer).not.toBeNull());
    terminer!(0);
    await service.derniereTache;
  });

  it('ignore le verrou d’un processus mort (exécution interrompue)', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(join(racine, 'poc', 'agent'), { recursive: true });
    await writeFile(join(racine, 'poc', 'agent', 'verrou.json'), JSON.stringify({ pid: 999999, numero: 1, phase: 'realisation' }));
    expect(await service.verrouActif('poc')).toBeNull();
    sortie = [resultat('{"decision":"plan","texte":"Plan."}')];
    await service.analyser(JETON, 'poc', 1);
    await service.derniereTache;
    expect(statut).toBe('plan-a-valider');
  });

  describe('verrou d’un projet', () => {
    const ecrireVerrou = async (pid: number, ageMs = 0) => {
      const { mkdir, utimes, writeFile } = await import('node:fs/promises');
      const chemin = join(racine, 'poc', 'agent', 'verrou.json');
      await mkdir(join(racine, 'poc', 'agent'), { recursive: true });
      await writeFile(chemin, JSON.stringify({ pid, numero: 1, phase: 'realisation' }));
      const date = new Date(Date.now() - ageMs);
      await utimes(chemin, date, date);
    };

    it('abandonne un verrou dont le processus existe encore mais ne bat plus (numéro de processus réutilisé)', async () => {
      await ecrireVerrou(process.pid, 10 * 60_000);
      expect(await service.verrouActif('poc')).toBeNull();
      sortie = [resultat('{"decision":"plan","texte":"Plan."}')];
      await service.analyser(JETON, 'poc', 1);
      await service.derniereTache;
      expect(statut).toBe('plan-a-valider');
    });

    it('garde un verrou dont le processus bat encore', async () => {
      await ecrireVerrou(process.pid, 5_000);
      expect((await service.verrouActif('poc'))?.numero).toBe(1);
      await expect(service.analyser(JETON, 'poc', 2)).rejects.toThrow(ConflictException);
    });

    it('deux processus qui trouvent le même verrou abandonné en même temps : un seul reprend la main', async () => {
      await ecrireVerrou(999999);
      const autre = new AgentService({ ...config(), DOSSIER_APERCUS: racine }, { client: () => gh } as unknown as GithubService, stories as unknown as StoriesService, apercu as unknown as ApercuService, projets as unknown as ProjetsService);
      let libere: ((code: number) => void) | null = null;
      const bloque: LancerAgent = () => new Promise((ok) => (libere = ok));
      service.lancerAgent = bloque;
      autre.lancerAgent = bloque;
      const resultats = await Promise.allSettled([service.analyser(JETON, 'poc', 1), autre.analyser(JETON, 'poc', 2)]);
      expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(resultats.filter((r) => r.status === 'rejected' && r.reason instanceof ConflictException)).toHaveLength(1);
      await vi.waitFor(() => expect(libere).not.toBeNull());
      libere!(0);
      await Promise.all([service.derniereTache, autre.derniereTache]);
    });

    it('rend le verrou et explique l’échec si le démarrage échoue (aperçu impossible à réveiller)', async () => {
      apercu.estEnVeille.mockReturnValue(true);
      apercu.demarrer.mockRejectedValue(new Error('Docker ne répond pas'));
      await expect(service.analyser(JETON, 'poc', 1)).rejects.toThrow('Docker ne répond pas');
      expect(await service.verrouActif('poc')).toBeNull();
      expect(await service.activite('poc', 1)).toMatchObject({ enCours: false, erreur: 'Docker ne répond pas' });
      apercu.estEnVeille.mockReturnValue(false);
      sortie = [resultat('{"decision":"plan","texte":"Plan."}')];
      await service.analyser(JETON, 'poc', 1); // le projet n’est pas resté « occupé »
      await service.derniereTache;
    });
  });

  describe('file d’attente : au plus AGENT_MAX_SIMULTANES agents sur la machine', () => {
    const occupes = (...projets: string[]) => apercu.projetsAvecAgent.mockImplementation(async () => projets);

    it('met la tâche en file quand tous les agents sont pris, sans lancer l’agent', async () => {
      occupes('a', 'b', 'c');
      await service.analyser(JETON, 'poc', 1);
      await service.derniereTache;
      expect(lancer).not.toHaveBeenCalled();
      expect(await service.verrouActif('poc')).toBeNull();
      expect(await service.enFile('poc', 1)).toBe(true);
      const activite = await service.activite('poc', 1);
      expect(activite.enCours).toBe(true);
      expect(activite.journal.at(-1)?.texte).toMatch(/En file d’attente \(1ᵉ\)/);
    });

    it('un projet en file est occupé : pas de seconde tâche, pas de commentaire GitHub écrit pour rien', async () => {
      occupes('a', 'b', 'c');
      await service.analyser(JETON, 'poc', 1);
      await expect(service.analyser(JETON, 'poc', 2)).rejects.toThrow(ConflictException);
      statut = 'plan-a-valider';
      await expect(service.validerPlan(JETON, 'po1', 'poc', 1)).rejects.toThrow(ConflictException);
      expect(stories.repondre).not.toHaveBeenCalled();
    });

    it('démarre la tâche dès qu’un agent se libère, une seule fois, et vide la file', async () => {
      occupes('a', 'b', 'c');
      sortie = [resultat('{"decision":"plan","texte":"Plan."}')];
      await service.analyser(JETON, 'poc', 1);
      await service.traiterFile();
      expect(lancer).not.toHaveBeenCalled(); // toujours plein
      occupes('a', 'b');
      await service.traiterFile();
      await service.derniereTache;
      expect(lancer).toHaveBeenCalledTimes(1);
      expect(statut).toBe('plan-a-valider');
      expect(await service.enFile('poc')).toBe(false);
      await service.traiterFile();
      expect(lancer).toHaveBeenCalledTimes(1);
    });

    it('respecte l’ordre d’arrivée : une seule place libre, la plus ancienne demande passe d’abord', async () => {
      occupes('a', 'b', 'c');
      await service.analyser(JETON, 'premier', 1);
      await new Promise((ok) => setTimeout(ok, 5));
      await service.analyser(JETON, 'second', 2);
      expect((await service.activite('second', 2)).journal.at(-1)?.texte).toMatch(/\(2ᵉ\)/);
      // Deux agents d’autres projets tournent ailleurs ; les verrous réels des projets de ce test comptent aussi.
      const verrous = () => readdirSync(racine).filter((projet) => verrouVivant(join(racine, projet, 'agent', 'verrou.json')));
      apercu.projetsAvecAgent.mockImplementation(async () => ['a', 'b', ...verrous()]);
      const demarres: string[] = [];
      const liberations: ((code: number) => void)[] = [];
      lancer.mockImplementation(async (_args, cwd) => {
        demarres.push(cwd);
        return new Promise<number>((ok) => liberations.push(ok));
      });
      await service.traiterFile();
      await vi.waitFor(() => expect(demarres).toHaveLength(1));
      expect(demarres).toEqual([join(racine, 'premier', 'depot')]);
      expect(await service.enFile('second', 2)).toBe(true);
      expect(await service.enFile('premier')).toBe(false);
      liberations[0]!(0);
      await service.derniereTache;
    });

    it('abandonne une tâche qui attend depuis trop longtemps (son jeton aurait expiré) et propose de relancer', async () => {
      occupes('a', 'b', 'c');
      await service.analyser(JETON, 'poc', 1);
      await service.traiterFile(Date.now() + 31 * 60_000);
      expect(await service.enFile('poc')).toBe(false);
      expect(lancer).not.toHaveBeenCalled();
      expect(await service.activite('poc', 1)).toMatchObject({ enCours: false, erreur: expect.stringContaining('Relancez-la') });
    });

    it('le fichier en attente (qui contient le jeton du PO) n’est lisible que par son propriétaire', async () => {
      occupes('a', 'b', 'c');
      await service.analyser(JETON, 'poc', 1);
      const { readdirSync, statSync } = await import('node:fs');
      const dossier = join(racine, '.file-attente');
      const [fichier] = readdirSync(dossier);
      expect(statSync(join(dossier, fichier!)).mode & 0o077).toBe(0);
      expect(statSync(dossier).mode & 0o077).toBe(0);
    });
  });
});
