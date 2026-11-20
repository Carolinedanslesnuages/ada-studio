import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { ConflictException } from '@nestjs/common';
import type { AgentService } from './agent.service.js';
import { action, type FauxApercu, JETON, preparerBanc, resultat } from './agent.banc.js';

describe('AgentService — réalisation', () => {
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

  it('ne réalise rien tant que le plan n’est pas proposé', async () => {
    statut = 'questions';
    await expect(service.validerPlan(JETON, 'po1', 'poc', 1)).rejects.toBeInstanceOf(ConflictException);
    expect(lancer).not.toHaveBeenCalled();
  });

  it('après validation : réalise sur une branche, pousse avec les droits du PO, ouvre la PR', async () => {
    statut = 'plan-a-valider';
    sortie = [action('Edit', { file_path: '/x/front/src/views/HomeView.vue' }), resultat('{"resultat":"ok","resume":"La page Ma journée est prête."}')];
    await service.validerPlan(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    expect(stories.repondre).toHaveBeenCalledWith(JETON, 'poc', 1, '✅ Plan validé par po1.');
    const outils = lancer.mock.calls[0]![0];
    expect(outils.some((o) => o.includes('push'))).toBe(false);
    expect(apercu.executer).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout', '-b', 'story/1-page-d-accueil', 'origin/main']));
    const push = apercu.executer.mock.calls.find(([, a]) => (a as string[]).includes('push'))!;
    expect((push[1] as string[]).join(' ')).not.toContain(JETON);
    expect(push[2]).toEqual({ env: { GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic secret' } });
    // L'aperçu est relancé sur le travail (API comprise) avant que le PO vérifie.
    expect(apercu.relancerApplication).toHaveBeenCalledWith('poc');
    expect(apercu.relancerApplication.mock.invocationCallOrder[0]).toBeLessThan(
      stories.changerStatut.mock.invocationCallOrder[stories.changerStatut.mock.calls.findIndex((appel) => appel[3] === 'en-verification')]!,
    );
    expect(gh.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({ head: 'story/1-page-d-accueil', base: 'main', title: 'feat: Page d’accueil', body: expect.stringContaining('Closes #1') }),
    );
    expect(statut).toBe('en-verification');
    expect((await service.activite('poc', 1)).pullRequest).toBe('https://github.com/proprio/poc/pull/2');
  });

  it('bloque proprement si l’agent n’a rien enregistré, sans pousser', async () => {
    statut = 'plan-a-valider';
    commits = '0';
    sortie = [resultat('{"resultat":"ok","resume":"Fait."}')];
    await service.validerPlan(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    expect(apercu.executer.mock.calls.some(([, a]) => (a as string[]).includes('push'))).toBe(false);
    expect(statut).toBe('besoin-dev');
  });

  it('bloque si l’agent déclare un blocage', async () => {
    statut = 'plan-a-valider';
    sortie = [resultat('{"resultat":"bloque","raison":"Les tests restent rouges"}')];
    await service.validerPlan(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    expect(stories.commenterAssistant).toHaveBeenCalledWith(JETON, 'poc', 1, 'Besoin d’aide', expect.stringContaining('Les tests restent rouges'));
    expect(statut).toBe('besoin-dev');
  });

  it('n’envoie rien si un fichier réservé aux développeurs a changé (quel que soit l’outil)', async () => {
    apercu.executer = vi.fn(async (_c: string, args: string[]) => ({
      stdout: args.includes('rev-list') ? '1\n' : args.includes('diff') ? 'src/App.vue\n.github/workflows/ci.yml\n' : args.includes('rev-parse') ? 'main\n' : '',
    }));
    statut = 'plan-a-valider';
    sortie = [resultat('{"resultat":"ok","resume":"Fait."}')];
    await service.validerPlan(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    const appels = apercu.executer.mock.calls.map((appel) => (appel[1] as string[]).join(' '));
    expect(appels.some((appel) => appel.includes('push'))).toBe(false);
    expect(gh.pulls.create).not.toHaveBeenCalled();
    expect(statut).toBe('besoin-dev');
    expect(stories.commenterAssistant).toHaveBeenCalledWith(JETON, 'poc', 1, 'Besoin d’aide', expect.stringContaining('.github/workflows/ci.yml'));
  });

  it('reprend la réalisation (sans nouvelle analyse) si le plan avait déjà été validé', async () => {
    statut = 'plan-a-valider';
    service.lancerAgent = async () => {
      throw new Error('coupure');
    };
    await service.validerPlan(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    expect((await service.activite('poc', 1)).erreur).toBe('coupure');
    service.lancerAgent = lancer;
    sortie = [resultat('{"resultat":"ok","resume":"Fait."}')];
    await service.relancer(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    const consigne = lancer.mock.calls.at(-1)![0][1]!;
    expect(consigne).toContain('PHASE : RÉALISATION');
    expect(statut).toBe('en-verification');
  });

  it('rétablit les package-lock.json retouchés par npm, mais refuse toute autre modification', async () => {
    statut = 'plan-a-valider';
    let etat = ' M api/package-lock.json\n';
    apercu.executer.mockImplementation(async (_c: string, args: string[]) => ({
      stdout: args.includes('rev-list') ? '1\n' : args.includes('status') ? etat : '',
    }));
    sortie = [resultat('{"resultat":"ok","resume":"Fait."}')];
    await service.validerPlan(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    expect(apercu.executer).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout', '--', 'api/package-lock.json']));
    expect(statut).toBe('en-verification');

    statut = 'plan-a-valider';
    etat = ' M api/package-lock.json\n M front/src/App.vue\n';
    await service.validerPlan(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    expect((await service.activite('poc', 1)).erreur).toMatch(/modifications non enregistrées/);
  });

  it('reprend le travail non enregistré d’une exécution interrompue sur la même branche', async () => {
    statut = 'en-cours';
    await (await import('node:fs/promises')).mkdir(join(racine, 'poc', 'agent'), { recursive: true });
    await (await import('node:fs/promises')).writeFile(join(racine, 'poc', 'agent', '1.json'), JSON.stringify({ phase: 'realisation', enCours: false, journal: [], erreur: 'coupure', debut: null, pullRequest: null }));
    apercu.executer.mockImplementation(async (_c: string, args: string[]) => ({
      stdout: args.includes('rev-list') ? '1\n' : args.includes('status') ? '?? front/src/__tests__/Barre.spec.ts\n' : args.includes('rev-parse') ? 'story/1-page-d-accueil\n' : '',
    }));
    sortie = [resultat('{"resultat":"ok","resume":"Fait."}')];
    await service.relancer(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    const consigne = lancer.mock.calls.at(-1)![0][1]!;
    expect(consigne).toContain('Reprise : une exécution précédente a été interrompue');
    expect(apercu.executer.mock.calls.some(([, a]) => (a as string[]).includes('-b'))).toBe(false);
    expect(statut).toBe('en-verification');
  });

  it('refuse des modifications non enregistrées sur une autre branche (deux demandes mélangées)', async () => {
    statut = 'plan-a-valider';
    apercu.executer.mockImplementation(async (_c: string, args: string[]) => ({
      stdout: args.includes('status') ? ' M front/src/App.vue\n' : args.includes('rev-parse') ? 'story/9-autre\n' : '',
    }));
    sortie = [resultat('{"resultat":"ok","resume":"Fait."}')];
    await service.validerPlan(JETON, 'po1', 'poc', 1);
    await service.derniereTache;
    expect((await service.activite('poc', 1)).erreur).toMatch(/modifications non enregistrées/);
    expect(lancer).not.toHaveBeenCalled();
  });

  describe('la branche poussée par ADA est mémorisée (la fusion refuse un commit venu d’ailleurs)', () => {
    it('note le commit poussé après une réalisation', async () => {
      apercu.executer.mockImplementation(async (_c: string, args: string[]) => ({
        stdout: args.includes('rev-list') ? '1\n' : args.includes('--abbrev-ref') ? 'main\n' : args.includes('rev-parse') ? 'f3a9c0de\n' : '',
      }));
      statut = 'plan-a-valider';
      sortie = [resultat('{"resultat":"ok","resume":"Fait."}')];
      await service.validerPlan(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      expect((await service.activite('poc', 1)).tete).toBe('f3a9c0de');
    });

    it('n’en note aucun quand rien n’est poussé (réalisation bloquée)', async () => {
      statut = 'plan-a-valider';
      sortie = [resultat('{"resultat":"bloque","raison":"Impossible."}')];
      await service.validerPlan(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      expect((await service.activite('poc', 1)).tete).toBeUndefined();
    });
  });
});
