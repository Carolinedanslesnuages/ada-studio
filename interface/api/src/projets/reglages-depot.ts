/** Réglages GitHub qu'ADA fait à la création d'un projet (labels, fusion en squash, versions automatiques). */
import type { Octokit } from '@octokit/rest';
import { LABELS_ATELIER } from './modeles.js';

const statut = (e: unknown) => (e as { status?: number }).status;

/**
 * Labels dont dépendent les formulaires d'issue (ils ne posent un label que s'il existe) et
 * les statuts de l'atelier. Un dépôt créé depuis un modèle n'hérite pas de ses labels.
 */
export async function poserLabels(gh: Octokit, owner: string, repo: string): Promise<void> {
  for (const label of LABELS_ATELIER) {
    try {
      await gh.issues.createLabel({ owner, repo, ...label });
    } catch (e) {
      if (statut(e) !== 422) throw e; // 422 : le label existe déjà (ex. « bug »)
    }
  }
}

/**
 * Fusion en « Squash and merge » uniquement : un commit par demande, titré comme la PR
 * (Conventional Commits pour release-please) ; branches supprimées après fusion.
 */
export async function imposerSquash(gh: Octokit, owner: string, repo: string, avertir: (message: string) => void): Promise<void> {
  try {
    await gh.repos.update({
      owner,
      repo,
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
      squash_merge_commit_title: 'PR_TITLE',
      squash_merge_commit_message: 'PR_BODY',
    });
  } catch (e) {
    avertir(`Squash non imposé sur ${repo} (${statut(e)}) : les fusions par ADA restent en squash`);
  }
}

/** Workflow permissions : lecture/écriture + création de PR (release-please). */
export async function autoriserReleasePlease(gh: Octokit, owner: string, repo: string, avertir: (message: string) => void): Promise<'fait' | 'a-faire'> {
  try {
    await gh.request('PUT /repos/{owner}/{repo}/actions/permissions/workflow', {
      owner,
      repo,
      default_workflow_permissions: 'write',
      can_approve_pull_request_reviews: true,
    });
    return 'fait';
  } catch (e) {
    avertir(`Réglage Actions refusé sur ${repo} (${statut(e)}) : à faire par le PO`);
    return 'a-faire';
  }
}
