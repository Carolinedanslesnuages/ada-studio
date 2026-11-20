/** Règles partagées avec l'API (api/src/projets/projet.ts). */
/** Identifiant d'un type de projet (liste fournie par l'API : api/src/projets/modeles.ts). */
export type TypeProjet = string

export interface FamilleDeProjet {
  id: string
  libelle: string
}

export interface TypeDeProjet {
  id: TypeProjet
  famille: string
  libelle: string
  description: string
}

export interface Modele {
  id: string
  type: TypeProjet
  libelle: string
  pourQuoi: string
  /** Modèle livré dans le catalogue d'ADA : on peut créer ce type de projet. */
  disponible: boolean
  /** Le modèle sait être déployé (image Docker et chart Helm). */
  deployable: boolean
  /** Partie front : null sans front ; « variantes » : le style et la bibliothèque se choisissent. */
  interface?: { variantes: boolean } | null
}

/** Style et bibliothèque de composants proposés à la création (api : variantes/combinaisons.json). */
export interface OptionInterface {
  valeur: string
  nom: string
  pourQui: string
  doc: string
  /** Intitulé du lien de documentation, s'il ne suffit pas de dire « Documentation de <nom> ». */
  libelleDoc?: string
}
export interface Combinaisons {
  parDefaut: { style: string; composants: string }
  styles: OptionInterface[]
  composants: OptionInterface[]
  interdites: { style: string; composants: string; raison: string }[]
}

/** Raison du refus d'une combinaison, ou null si elle est autorisée. */
export function raisonRefus(combinaisons: Combinaisons, style: string, composants: string): string | null {
  return combinaisons.interdites.find((regle) => regle.style === style && regle.composants === composants)?.raison ?? null
}

/** Conseil de l'assistant : le modèle le plus adapté à l'idée, et pourquoi, en une phrase (#68). */
export interface ConseilStack {
  modele: string
  raison: string
}

/** Idée racontée librement à la création (même succincte ou décousue) (#68). */
export const IDEE_MAX = 4000

export interface NouveauProjet {
  nom: string
  /** Facultatif si une idée est racontée : ADA le déduit alors de sa première phrase. */
  objectif: string
  /** L'idée du PO, telle qu'elle vient : première demande du projet, étudiée par l'assistant. */
  idee?: string
  modele: string
  /** Facultative : phrase courte sous le nom du service dans l'en-tête. */
  baseline: string
  /** Le projet sera déployé : ADA ajoute le chart Helm du modèle. */
  deploye: boolean
  /** Dépôt GitHub privé (par défaut) ou public, visible de tous. */
  visibilite?: 'prive' | 'public'
  /** Style de l'interface (modèles avec front) : « css-maison » par défaut. */
  style?: string
  /** Bibliothèque de composants (modèles avec front) : « aucune » par défaut. */
  composants?: string
}

export type ErreursProjet = Partial<Record<keyof NouveauProjet, string>>

export interface Reglage {
  etat: 'fait' | 'a-faire'
  lien: string
}

export interface ResultatCreation {
  projet: { id: string; nom: string; proprietaire: string; compte: 'organisation' | 'personnel'; reprise: { pullRequest: string | null } | null; repris: boolean; description: string | null; prive: boolean; url: string; misAJourLe: string | null }
  reglages: { versionsAutomatiques: Reglage; protectionMain: Reglage }
  /** Numéro de la demande créée à partir de l'idée ; null sans idée (ou si elle n'a pu être enregistrée). */
  idee?: number | null
}

export function normaliserNom(nom: string): string {
  return nom.replace(/'/g, '’').replace(/\s+/g, ' ').trim()
}

export function slugifier(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

export function verifierProjet(projet: NouveauProjet): ErreursProjet {
  const erreurs: ErreursProjet = {}
  const nom = normaliserNom(projet.nom)
  if (nom.length < 3 || slugifier(nom).length < 3) erreurs.nom = 'Le nom doit faire au moins 3 caractères'
  else if (!/^[\p{L}\p{N}][\p{L}\p{N} ’-]*$/u.test(nom))
    erreurs.nom = 'Lettres, chiffres, espaces, tirets et apostrophes uniquement'
  else if (nom.length > 60) erreurs.nom = '60 caractères au maximum'
  const idee = (projet.idee ?? '').trim()
  const objectif = projet.objectif.replace(/\s+/g, ' ').trim()
  if (!idee && !objectif) erreurs.idee = 'Racontez votre idée, même en quelques mots'
  else if (idee && idee.length < 10) erreurs.idee = 'Quelques mots de plus : une phrase au moins'
  else if (idee.length > IDEE_MAX) erreurs.idee = `${IDEE_MAX} caractères au maximum`
  if (objectif && objectif.length < 10) erreurs.objectif = 'Décrivez l’objectif en une ou deux phrases'
  else if (objectif.length > 300) erreurs.objectif = '300 caractères au maximum'
  if (!projet.modele) erreurs.modele = 'Choisissez une stack'
  const baseline = normaliserNom(projet.baseline)
  if (baseline.length > 80) erreurs.baseline = '80 caractères au maximum'
  else if (!/^[\p{L}\p{N} ’.,!?:;()«»-]*$/u.test(baseline))
    erreurs.baseline = 'Lettres, chiffres, espaces et ponctuation simple uniquement'
  return erreurs
}
