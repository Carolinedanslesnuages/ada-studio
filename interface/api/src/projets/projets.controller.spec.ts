import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { ProjetsController } from './projets.controller.js';
import type { ProjetsService } from './projets.service.js';
import type { RepriseService } from './reprise.service.js';
import type { RegistreService } from '../indicateurs/registre.service.js';
import type { AgentService } from '../agent/agent.service.js';

const requete = { session: { jeton: 'jeton', utilisateur: { login: 'un-po' } } } as unknown as Request;

const monter = (idee: number | null, agentDisponible = true) => {
  const projets = { creer: vi.fn(async () => ({ projet: { id: 'covoiturage' }, reglages: {}, idee })) };
  const registre = { noter: vi.fn(async () => undefined) };
  const agent = {
    verifierDisponible: vi.fn(() => {
      if (!agentDisponible) throw new Error('Aucun agent');
    }),
    analyser: vi.fn(async () => undefined),
  };
  const controleur = new ProjetsController(
    projets as unknown as ProjetsService,
    {} as RepriseService,
    registre as unknown as RegistreService,
    agent as unknown as AgentService,
  );
  return { controleur, agent };
};

describe('Création d’un projet (route)', () => {
  it('lance aussitôt ADA sur l’idée de départ (#68)', async () => {
    const { controleur, agent } = monter(1);
    await expect(controleur.creer(requete, {})).resolves.toMatchObject({ idee: 1 });
    expect(agent.analyser).toHaveBeenCalledWith('jeton', 'covoiturage', 1, 'un-po');
  });

  it('sans idée, rien n’est lancé ; sans assistant, la création réussit quand même', async () => {
    const sansIdee = monter(null);
    await sansIdee.controleur.creer(requete, {});
    expect(sansIdee.agent.analyser).not.toHaveBeenCalled();
    const sansAgent = monter(1, false);
    await expect(sansAgent.controleur.creer(requete, {})).resolves.toMatchObject({ idee: 1 });
    expect(sansAgent.agent.analyser).not.toHaveBeenCalled();
  });
});
