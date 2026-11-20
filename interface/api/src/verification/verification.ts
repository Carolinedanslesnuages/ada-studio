/** Règles de fusion d'une demande réalisée : fonctions pures. */
import { ADA_PAR_DEFAUT } from '../ada/ada-config.js';
import { estTitreConventionnel } from '../versions/conventionnel.js';

/** « non-lance » : GitHub a refusé de lancer le contrôle (facturation du compte, quota de minutes). */
export type EtatControle = 'en-attente' | 'en-cours' | 'reussi' | 'echec' | 'non-lance';

export interface Controle {
  nom: string;
  etat: EtatControle;
  lien: string | null;
}

export interface Verification {
  pullRequest: { numero: number; url: string; etat: 'ouverte' | 'fusionnee' | 'fermee' } | null;
  controles: Controle[];
  fusionnable: boolean;
  raison: string | null;
}

export type CheckRun = { id?: number; name: string; status: string; conclusion: string | null; html_url?: string | null };

/** État des contrôles exigés, à partir des « check runs » GitHub du dernier commit de la PR. */
export function etatControles(runs: CheckRun[], requis: string[] = ADA_PAR_DEFAUT.controlesRequis): Controle[] {
  return requis.map((nom) => {
    const run = runs.filter((r) => r.name === nom).at(-1);
    if (!run) return { nom, etat: 'en-attente', lien: null };
    if (run.status !== 'completed') return { nom, etat: 'en-cours', lien: run.html_url ?? null };
    const ok = run.conclusion === 'success';
    return { nom, etat: ok ? 'reussi' : 'echec', lien: run.html_url ?? null };
  });
}

/** La fusion n'est possible que si la PR est ouverte, sans conflit, et tous les contrôles verts. */
export function peutFusionner(
  etatPr: 'ouverte' | 'fusionnee' | 'fermee',
  sansConflit: boolean | null,
  controles: Controle[],
  titre: string,
): { fusionnable: boolean; raison: string | null } {
  if (etatPr === 'fusionnee') return { fusionnable: false, raison: 'Déjà fusionnée' };
  if (etatPr === 'fermee') return { fusionnable: false, raison: 'La pull request a été fermée sans fusion' };
  if (!estTitreConventionnel(titre)) {
    return {
      fusionnable: false,
      raison: `Le titre « ${titre} » ne commence pas par « feat: » ou « fix: » : il décide du numéro de la prochaine version. Un développeur doit le corriger`,
    };
  }
  if (controles.some((c) => c.etat === 'non-lance')) return { fusionnable: false, raison: RAISON_NON_LANCE };
  const echec = controles.find((c) => c.etat === 'echec');
  if (echec) return { fusionnable: false, raison: `Le contrôle « ${echec.nom} » a échoué : la demande doit être corrigée` };
  if (controles.some((c) => c.etat !== 'reussi')) return { fusionnable: false, raison: 'Contrôles en cours…' };
  if (sansConflit === false) return { fusionnable: false, raison: 'La pull request est en conflit avec le projet : un développeur doit intervenir' };
  if (sansConflit === null) return { fusionnable: false, raison: 'GitHub vérifie que la fusion est possible…' };
  return { fusionnable: true, raison: null };
}

/** Message de GitHub quand il refuse de lancer un job (paiement en échec, limite de dépense atteinte). */
const NON_LANCE = /job was not started|spending limit|payments? (have|has) failed|billing/i;

export function estNonLance(annotations: string[]): boolean {
  return annotations.some((message) => NON_LANCE.test(message));
}

export const RAISON_NON_LANCE =
  'GitHub n’a pas lancé les contrôles : le compte qui possède ce projet a atteint sa limite de dépense GitHub Actions, ou un paiement a échoué (GitHub → Settings → Billing & plans). Le code n’est pas en cause. Une fois réglé, cliquez sur « Relancer les contrôles ».';

/** Exécution (workflow run) d'un contrôle, d'après son adresse …/actions/runs/<id>/job/<id>. */
export function executionDepuisLien(lien: string | null | undefined): number | null {
  const m = lien?.match(/\/actions\/runs\/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function numeroDepuisUrl(url: string | null): number | null {
  const m = url?.match(/\/pull\/(\d+)$/);
  return m ? Number(m[1]) : null;
}
