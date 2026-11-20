import type { Octokit } from '@octokit/rest';
import { estNonLance, etatControles, executionDepuisLien, type CheckRun, type Controle } from './verification.js';

/**
 * Contrôles exigés d'un commit, en distinguant un vrai échec d'un contrôle que GitHub a refusé de
 * lancer (facturation) : seul ce dernier est expliqué au PO comme un problème de compte.
 */
export async function lireControles(gh: Octokit, owner: string, repo: string, sha: string, requis: string[]): Promise<Controle[]> {
  const { data } = await gh.checks.listForRef({ owner, repo, ref: sha, per_page: 100 });
  const runs = data.check_runs as CheckRun[];
  const controles = etatControles(runs, requis);
  return Promise.all(
    controles.map(async (controle) => {
      const run = runs.filter((r) => r.name === controle.nom).at(-1);
      if (controle.etat !== 'echec' || !run?.id) return controle;
      const { data: annotations } = await gh.checks.listAnnotations({ owner, repo, check_run_id: run.id }).catch(() => ({ data: [] }));
      return estNonLance(annotations.map((annotation) => annotation.message ?? '')) ? { ...controle, etat: 'non-lance' as const } : controle;
    }),
  );
}

/** Relance les contrôles en échec ou non lancés d'un commit (une fois la facturation réglée). */
export async function relancerControles(gh: Octokit, owner: string, repo: string, sha: string): Promise<number> {
  const { data } = await gh.checks.listForRef({ owner, repo, ref: sha, per_page: 100 });
  const executions = new Set(
    (data.check_runs as CheckRun[])
      .filter((run) => run.status === 'completed' && run.conclusion !== 'success' && run.conclusion !== 'skipped')
      .map((run) => executionDepuisLien(run.html_url))
      .filter((id): id is number => id !== null),
  );
  for (const run_id of executions) await gh.actions.reRunWorkflowFailedJobs({ owner, repo, run_id });
  return executions.size;
}
