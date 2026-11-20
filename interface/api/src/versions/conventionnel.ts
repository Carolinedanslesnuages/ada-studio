/**
 * Conventional Commits 1.0.0 : `type(portée)!: description`. Sur main, chaque commit vient du
 * titre d'une PR (fusion en squash) et décide de la prochaine version (semver, via release-please) :
 * `fix` → correctif (0.0.x), `feat` → fonctionnalité (0.x.0), `!` ou `BREAKING CHANGE` →
 * changement incompatible (x.0.0 ; avant 1.0.0, 0.x.0). Les autres types ne créent pas de version.
 * Même règle que le contrôle « Titre de PR » de la CI (catalogue/<modèle>/.github/workflows/titre-pr.yml).
 */
export const TYPES_CONVENTIONNELS = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert'] as const;

const MOTIF = new RegExp(`^(${TYPES_CONVENTIONNELS.join('|')})(\\([^()\\s][^()]*\\))?!?: \\S`);

export function estTitreConventionnel(titre: string): boolean {
  return MOTIF.test(titre);
}
