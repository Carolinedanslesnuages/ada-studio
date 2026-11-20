import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentService } from './agent.service.js';
import { preparerBanc, resultat } from './agent.banc.js';

describe('AgentService — conseil de stack', () => {
  let service: AgentService;
  let lancer: ReturnType<typeof preparerBanc>['lancer'];
  let sortie: string[];
  let statut: string;
  let commits = '1';

  beforeEach(() => {
    statut = 'en-cours';
    commits = '1';
    sortie = [];
    ({ service, lancer } = preparerBanc({ sortie: () => sortie, statut: () => statut, changerStatut: (nouveau) => (statut = nouveau), commits: () => commits }));
  });

  it('conseille une stack d’après l’idée du PO, sans aucun outil, parmi les seuls modèles livrés (#68)', async () => {
    sortie = [resultat('{"modele":"vue-node","raison":"Une petite application avec quelques écrans suffit."}')];
    expect(await service.conseillerStack('les agents réservent une salle de réunion, simplement')).toEqual({
      modele: 'vue-node',
      raison: 'Une petite application avec quelques écrans suffit.',
    });
    const args = lancer.mock.calls[0]![0];
    expect(args).not.toContain('--allowedTools');
    expect(args.slice(args.indexOf('--disallowedTools') + 1)).toEqual(expect.arrayContaining(['Bash', 'Read', 'Write', 'WebFetch']));
    const consigne = args[args.indexOf('-p') + 1]!;
    expect(consigne).toContain('les agents réservent une salle de réunion');
    expect(consigne).toContain('- vue-node : Application en ligne');
    expect(consigne).not.toContain('django');
  });

  it('refuse une idée trop courte, et une réponse hors liste d’ADA', async () => {
    await expect(service.conseillerStack('salle')).rejects.toThrow(/une phrase au moins/);
    sortie = [resultat('{"modele":"django","raison":"x"}')];
    await expect(service.conseillerStack('les agents réservent une salle de réunion')).rejects.toThrow(/choisissez-la vous-même/);
  });

  it('plafonne les conseils de stack simultanés (chacun lance un agent, sans verrou de projet)', async () => {
    const liberations: ((code: number) => void)[] = [];
    service.lancerAgent = () => new Promise((ok) => liberations.push(ok));
    const idee = 'Un petit outil pour réserver des salles de réunion';
    const premiers = [service.conseillerStack(idee), service.conseillerStack(idee), service.conseillerStack(idee)];
    await vi.waitFor(() => expect(liberations).toHaveLength(3));
    await expect(service.conseillerStack(idee)).rejects.toMatchObject({ status: 429 });
    liberations.forEach((liberer) => liberer(0));
    await Promise.allSettled(premiers);
    service.lancerAgent = lancer;
    sortie = [resultat('{"modele":"vue-node","raison":"Simple."}')];
    await expect(service.conseillerStack(idee)).resolves.toMatchObject({ modele: 'vue-node' }); // places rendues
  });
});
