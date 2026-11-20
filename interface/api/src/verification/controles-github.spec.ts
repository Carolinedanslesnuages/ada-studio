import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from '@octokit/rest';
import { lireControles, relancerControles } from './controles-github.js';
import { estNonLance, executionDepuisLien, peutFusionner, RAISON_NON_LANCE } from './verification.js';

const FACTURATION =
  "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings";
const TITRE = 'Titre de PR (Conventional Commits, semver)';
const run = (id: number, conclusion: string, execution: number) => ({
  id,
  name: TITRE,
  status: 'completed',
  conclusion,
  html_url: `https://github.com/p/poc/actions/runs/${execution}/job/${id}`,
});

describe('contrôles que GitHub n’a pas lancés (facturation)', () => {
  it('reconnaît le message de GitHub, pas un vrai échec', () => {
    expect(estNonLance([FACTURATION])).toBe(true);
    expect(estNonLance(['Process completed with exit code 1.'])).toBe(false);
  });

  it('retrouve l’exécution à relancer depuis le lien du contrôle', () => {
    expect(executionDepuisLien('https://github.com/p/poc/actions/runs/44036388445/job/133880159636')).toBe(44036388445);
    expect(executionDepuisLien(null)).toBeNull();
  });

  it('la fusion attend, avec une explication qui met le code hors de cause', () => {
    const resultat = peutFusionner('ouverte', true, [{ nom: TITRE, etat: 'non-lance', lien: null }], 'chore: reprise');
    expect(resultat).toEqual({ fusionnable: false, raison: RAISON_NON_LANCE });
    expect(RAISON_NON_LANCE).toContain('Billing & plans');
  });

  it('lit les annotations d’un contrôle en échec pour distinguer « non lancé » d’« échec »', async () => {
    const gh = {
      checks: {
        listForRef: vi.fn(async () => ({ data: { check_runs: [run(1, 'failure', 10)] } })),
        listAnnotations: vi.fn(async () => ({ data: [{ message: FACTURATION }] })),
      },
    };
    expect(await lireControles(gh as unknown as Octokit, 'p', 'poc', 'sha', [TITRE])).toEqual([{ nom: TITRE, etat: 'non-lance', lien: expect.any(String) }]);
    gh.checks.listAnnotations.mockResolvedValue({ data: [{ message: 'Process completed with exit code 1.' }] });
    expect((await lireControles(gh as unknown as Octokit, 'p', 'poc', 'sha', [TITRE]))[0]!.etat).toBe('echec');
  });

  it('relance une fois chaque exécution en échec, jamais celles réussies', async () => {
    const gh = {
      checks: { listForRef: vi.fn(async () => ({ data: { check_runs: [run(1, 'failure', 10), run(2, 'failure', 10), run(3, 'success', 11), run(4, 'failure', 12)] } })) },
      actions: { reRunWorkflowFailedJobs: vi.fn(async () => ({})) },
    };
    expect(await relancerControles(gh as unknown as Octokit, 'p', 'poc', 'sha')).toBe(2);
    expect(gh.actions.reRunWorkflowFailedJobs.mock.calls.map((appel) => (appel as unknown as [{ run_id: number }])[0].run_id)).toEqual([10, 12]);
  });
});
