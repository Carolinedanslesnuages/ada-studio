import { z } from 'zod';
import { resumerPrompt } from '../stories/story.js';
import { COMPOSANTS, STYLES } from '../ada/ada-config.js';

/** Idée racontée librement à la création : longue si besoin, sans format imposé (#68). */
export const IDEE_MAX = 4000;

/** Marqueurs présents dans les dépôts modèles, remplacés à la création d'un projet. */
export interface ValeursProjet {
  nom: string;
  /** Phrase courte sous le nom du service dans l'en-tête ; vide = aucune. */
  baseline: string;
  slug: string;
  objectif: string;
  date: string;
  po: string;
}

/** Apostrophe droite → typographique, espaces normalisés (le nom est injecté dans du HTML, du TS, du YAML). */
export function normaliserNom(nom: string): string {
  return nom.replace(/'/g, '’').replace(/\s+/g, ' ').trim();
}

/** Nom du dépôt GitHub : minuscules, sans accents, tirets. */
export function slugifier(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

const schema = z.object({
  nom: z
    .string()
    .transform(normaliserNom)
    .pipe(
      z
        .string()
        .min(3, 'Le nom doit faire au moins 3 caractères')
        .max(60, '60 caractères au maximum')
        .regex(
          /^[\p{L}\p{N}][\p{L}\p{N} ’-]*$/u,
          'Lettres, chiffres, espaces, tirets et apostrophes uniquement',
        ),
    ),
  /** Facultatif dès qu'une idée est racontée : déduit alors de sa première phrase. */
  objectif: z
    .string()
    .optional()
    .default('')
    .transform((o) => o.replace(/\s+/g, ' ').trim())
    .pipe(z.string().max(300, '300 caractères au maximum')),
  /** L'idée du PO, telle qu'elle vient (même succincte ou décousue) : première demande du projet. */
  idee: z
    .string()
    .optional()
    .default('')
    .transform((texte) => texte.trim())
    .pipe(z.string().max(IDEE_MAX, `${IDEE_MAX} caractères au maximum`)),
  modele: z.string().min(1, 'Choisissez une stack'),
  /** Visibilité du dépôt GitHub choisie par le PO : privé par défaut, ou public (visible de tous). */
  visibilite: z.enum(['prive', 'public']).optional().default('prive'),
  /** Style de l'interface (modèles avec front) : CSS maison par défaut (variantes/combinaisons.json). */
  style: z.enum(STYLES, 'Choisissez un style proposé').optional().default('css-maison'),
  /** Bibliothèque de composants (modèles avec front) : aucune par défaut. */
  composants: z.enum(COMPOSANTS, 'Choisissez une bibliothèque proposée').optional().default('aucune'),
  /** Le PO prévoit de déployer le projet : le chart Helm du modèle est ajouté. */
  deploye: z.boolean().optional().default(false),
  baseline: z
    .string()
    .optional()
    .default('')
    .transform(normaliserNom)
    .pipe(
      z
        .string()
        .max(80, '80 caractères au maximum')
        .regex(/^[\p{L}\p{N} ’.,!?:;()«»-]*$/u, 'Lettres, chiffres, espaces et ponctuation simple uniquement'),
    ),
})
  .superRefine((projet, ctx) => {
    if (!projet.idee && !projet.objectif) {
      ctx.addIssue({ code: 'custom', path: ['idee'], message: 'Racontez votre idée, même en quelques mots' });
    } else if (projet.idee && projet.idee.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['idee'], message: 'Quelques mots de plus : une phrase au moins' });
    }
    if (projet.objectif && projet.objectif.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['objectif'], message: 'Décrivez l’objectif en une ou deux phrases' });
    }
  })
  .transform((projet) => {
    const objectif = projet.objectif || resumerPrompt(projet.idee, 290);
    return { ...projet, objectif: /[.!?…]$/.test(objectif) ? objectif : `${objectif}.` };
  });

export type NouveauProjet = z.output<typeof schema>;
export type ErreursProjet = Partial<Record<keyof NouveauProjet, string>>;

export function validerProjet(
  donnees: unknown,
): { ok: true; projet: NouveauProjet; slug: string } | { ok: false; erreurs: ErreursProjet } {
  const resultat = schema.safeParse(donnees);
  if (!resultat.success) {
    const erreurs: ErreursProjet = {};
    for (const probleme of resultat.error.issues) {
      const champ = probleme.path[0] as keyof NouveauProjet;
      erreurs[champ] ??= probleme.message;
    }
    return { ok: false, erreurs };
  }
  const slug = slugifier(resultat.data.nom);
  if (slug.length < 3) return { ok: false, erreurs: { nom: 'Le nom doit contenir au moins 3 lettres ou chiffres' } };
  return { ok: true, projet: resultat.data, slug };
}

export function personnaliser(texte: string, v: ValeursProjet): string {
  return texte
    .replaceAll('__NOM_PROJET__', v.nom)
    .replaceAll('__BASELINE__', v.baseline)
    .replaceAll('__SLUG__', v.slug)
    .replaceAll('__OBJECTIF__', v.objectif)
    .replaceAll('__DATE__', v.date)
    .replaceAll('__PO__', v.po);
}
