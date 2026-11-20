/** Versions d'un projet (release-please) : lecture du récapitulatif et règle de publication. */

/** Seuls fichiers qu'une PR de version a le droit de toucher : aucun code, donc rien à contrôler. */
export const FICHIERS_DE_VERSION = ['CHANGELOG.md', 'version.txt', '.release-please-manifest.json'];
export const PREFIXE_BRANCHE_VERSION = 'release-please--';

export interface ElementVersion {
  texte: string;
  /** Numéro de l'issue (story ou problème) livrée, si connu. */
  demande: number | null;
}

export interface Recapitulatif {
  version: string | null;
  nouveautes: ElementVersion[];
  corrections: ElementVersion[];
  autres: ElementVersion[];
}

const RUBRIQUES: Record<string, keyof Omit<Recapitulatif, 'version'>> = {
  features: 'nouveautes',
  'bug fixes': 'corrections',
};

/** « chore(main): release 0.2.0 » → « 0.2.0 ». */
export function versionDepuisTitre(titre: string): string | null {
  return titre.match(/release v?(\d+\.\d+\.\d+)/)?.[1] ?? null;
}

/** Transforme le corps de la PR de release-please en récapitulatif lisible par le PO. */
export function lireRecapitulatif(titre: string, corps: string): Recapitulatif {
  const recap: Recapitulatif = { version: versionDepuisTitre(titre), nouveautes: [], corrections: [], autres: [] };
  let rubrique: keyof Omit<Recapitulatif, 'version'> = 'autres';
  for (const ligne of corps.split('\n')) {
    const titreRubrique = ligne.match(/^###\s+(.+)$/);
    if (titreRubrique) {
      rubrique = RUBRIQUES[titreRubrique[1]!.trim().toLowerCase()] ?? 'autres';
      continue;
    }
    const element = ligne.match(/^\*\s+(.+)$/);
    if (!element) continue;
    const brut = element[1]!;
    const texte = brut.replace(/\s*\(\[[^\]]*\]\([^)]*\)\).*$/, '').replace(/\*\*/g, '').trim();
    const demande = brut.match(/closes \[#(\d+)\]/i)?.[1];
    recap[rubrique].push({ texte, demande: demande ? Number(demande) : null });
  }
  return recap;
}

/** Publiable seulement si la PR ne touche que les fichiers de version. */
export function peutPublier(fichiers: string[]): { publiable: boolean; raison: string | null } {
  const autres = fichiers.filter((f) => !FICHIERS_DE_VERSION.includes(f));
  if (fichiers.length === 0) return { publiable: false, raison: 'La version proposée est vide' };
  if (autres.length) {
    return {
      publiable: false,
      raison: `La version proposée modifie aussi d’autres fichiers (${autres.join(', ')}) : un développeur doit vérifier`,
    };
  }
  return { publiable: true, raison: null };
}
