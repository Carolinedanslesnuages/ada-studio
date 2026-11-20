/** Stories et problèmes : écrits par le PO dans GitHub, lus et lancés depuis l'atelier. */
export const CRITERES_MAX = 4

export type Statut =
  | 'nouvelle'
  | 'en-cours'
  | 'questions'
  | 'plan-a-valider'
  | 'en-verification'
  | 'besoin-dev'
  | 'decoupage'
  | 'parent'
  | 'attente'
  | 'echange'
  | 'livree'

export const STATUTS_ACTIFS: Statut[] = [
  'en-cours',
  'questions',
  'plan-a-valider',
  'en-verification',
  'besoin-dev',
  'decoupage',
  'echange',
]

export const LIBELLES_STATUT: Record<
  Statut,
  { libelle: string; type: 'info' | 'new' | 'warning' | 'success' | 'error' }
> = {
  nouvelle: { libelle: 'À lancer', type: 'new' },
  'en-cours': { libelle: 'En cours', type: 'info' },
  questions: { libelle: 'Questions', type: 'warning' },
  'plan-a-valider': { libelle: 'Plan à valider', type: 'warning' },
  'en-verification': { libelle: 'À vérifier', type: 'info' },
  'besoin-dev': { libelle: 'Besoin d’un développeur', type: 'error' },
  decoupage: { libelle: 'Découpage à valider', type: 'warning' },
  parent: { libelle: 'Découpée', type: 'info' },
  attente: { libelle: 'En attente', type: 'info' },
  echange: { libelle: 'À vous', type: 'warning' },
  livree: { libelle: 'Livrée', type: 'success' },
}

export type TypeDemande = 'story' | 'bug' | 'libre' | 'conversation'

/** Conversation (« vrai prompt ») : la taille d'un message, de « oui » à un long cahier des charges. */
export const MESSAGE_MAX = 8000
/** Commentaire de lancement, posé par ADA : pas un message de la conversation. */
export const MARQUEUR_LANCEMENT = '▶️ Lancée depuis ADA'

export interface ResumeStory {
  numero: number
  type: TypeDemande
  titre: string
  statut: Statut
  creeeLe: string
  /** Date de livraison (issue fermée), null sinon. */
  fermeeLe: string | null
  url: string
  prete: boolean
  raison: string | null
  /** Demande découpée dont la story est issue (ordre du découpage) ; null sinon. */
  parent?: number | null
}

/**
 * Ordre conseillé des demandes à lancer : d'abord celles qui sont prêtes ; parmi elles, les
 * problèmes signalés (ils gênent l'usage) ; puis les stories d'un même découpage restent
 * ensemble, dans l'ordre proposé par ADA (dépendances) ; le reste, de la plus ancienne à la plus récente.
 * Les demandes en attente (rien à construire pour l'instant) passent toujours en dernier.
 */
/** Demande qui peut être lancée : jamais lancée, ou mise en attente par ADA (relance). */
export const aLancerOuRelancer = (story: Pick<ResumeStory, 'statut'>) => story.statut === 'nouvelle' || story.statut === 'attente'

export function ordonnerALancer(stories: ResumeStory[]): ResumeStory[] {
  const origine = (story: ResumeStory) => story.parent ?? story.numero
  return [...stories].sort(
    (a, b) =>
      Number(a.statut === 'attente') - Number(b.statut === 'attente') ||
      Number(b.prete) - Number(a.prete) ||
      Number(b.type === 'bug') - Number(a.type === 'bug') ||
      origine(a) - origine(b) ||
      a.numero - b.numero,
  )
}

export interface ContenuStory {
  role: string
  besoin: string
  benefice: string
  criteres: string[]
}

export interface ContenuBug {
  constate: string
  attendu: string
  etapes: string
  ecran: string
}

export interface Message {
  id: number
  auteur: string
  avatar: string | null
  texte: string
  le: string
}

/** Développeur qui peut être assigné (accès au dépôt du projet). */
export interface Personne {
  login: string
  avatar: string | null
}

export interface DetailStory extends ResumeStory {
  /** Développeurs assignés sur GitHub. */
  assignes: Personne[]
  contenu: ContenuStory | null
  contenuBug: ContenuBug | null
  contenuLibre: string | null
  texteBrut: string
  messages: Message[]
  /** Empreinte du contenu affiché : renvoyée au lancement (ADA refuse si l'issue a changé entre-temps). */
  empreinte?: string
  /** Commentaires écrits directement sur GitHub depuis le lancement : ADA ne les lit pas. */
  commentairesIgnores?: number
}

/** Adresse du formulaire GitHub pour écrire une story ou signaler un problème. */
export function lienNouvelleIssue(urlDepot: string, modele: 'user-story.yml' | 'bug.yml'): string {
  return `${urlDepot}/issues/new?template=${modele}`
}

/** Ce que fait l'assistant sur une demande (journal lisible par le PO). */
export interface Activite {
  phase: 'analyse' | 'realisation' | 'reprise' | 'conversation' | null
  enCours: boolean
  debut: string | null
  journal: { le: string; texte: string }[]
  erreur: string | null
  pullRequest: string | null
}

export const MARQUEUR_ASSISTANT = '<!-- ada-studio:assistant -->'

/** Question qui se tranche entre quelques options (api/src/agent/agent.ts, #35). */
export interface QuestionAChoix {
  question: string
  choix: string[]
  plusieurs: boolean
}

const DONNEES_CHOIX = /<!-- ada:choix (\S+) -->/
const BLOC_CHOIX_LISIBLE = /\n*\*\*Choix proposés\*\* \(à cocher dans ADA\) :[\s\S]*$/

/** Choix structurés joints par l'assistant à ses questions ; [] s'il n'y en a pas (ou illisibles). */
export function lireChoix(texte: string): QuestionAChoix[] {
  const donnees = DONNEES_CHOIX.exec(texte)?.[1]
  if (!donnees) return []
  try {
    const choix = JSON.parse(decoderBase64(donnees)) as QuestionAChoix[]
    return Array.isArray(choix) ? choix.filter((question) => question.question && question.choix?.length >= 2) : []
  } catch {
    return []
  }
}

/** Réponse envoyée à l'assistant (et enregistrée sur GitHub) : lisible, une question par paragraphe. */
export function composerReponse(questions: QuestionAChoix[], reponses: { coches: string[]; precision: string }[]): string {
  return questions
    .map((question, rang) => {
      const reponse = reponses[rang] ?? { coches: [], precision: '' }
      const lignes = [`${rang + 1}. ${question.question}`]
      if (reponse.coches.length) lignes.push(`→ ${reponse.coches.join(' ; ')}`)
      if (reponse.precision.trim()) lignes.push(`Précision : ${reponse.precision.trim()}`)
      return lignes.join('\n')
    })
    .join('\n\n')
}

/** Story proposée par l'assistant quand une demande est trop grosse (#36). */
export interface StoryProposee {
  titre: string
  role: string
  besoin: string
  benefice: string
  criteres: string[]
  /** Story déjà dans le projet que celle-ci recoupe (signalée par ADA) : décochée par défaut. */
  doublonDe?: number
}

const DONNEES_DECOUPAGE = /<!-- ada:decoupage (\S+) -->/
const BLOC_DECOUPAGE_LISIBLE = /\n*\*\*Stories proposées\*\* \(à choisir dans ADA\) :[\s\S]*$/

const decoderBase64 = (donnees: string) => new TextDecoder().decode(Uint8Array.from(atob(donnees), (caractere) => caractere.charCodeAt(0)))

export function lireDecoupage(texte: string): StoryProposee[] {
  const donnees = DONNEES_DECOUPAGE.exec(texte)?.[1]
  if (!donnees) return []
  try {
    const stories = JSON.parse(decoderBase64(donnees)) as StoryProposee[]
    return Array.isArray(stories) ? stories.filter((story) => story.titre && story.criteres?.length) : []
  } catch {
    return []
  }
}

/** Stories d'une demande découpée, lues dans sa liste à cocher (section « Découpage »). */
export function lireStoriesParent(corps: string): { numero: number; titre: string; livree: boolean }[] {
  const section = corps.split('### Découpage')[1] ?? ''
  return [...section.matchAll(/^- \[( |x)\] #(\d+) (.*)$/gm)].map((ligne) => ({
    numero: Number(ligne[2]),
    titre: ligne[3]!.trim(),
    livree: ligne[1] === 'x',
  }))
}

/** Message affiché au PO : les messages de l'assistant sont signés « Assistant », sans marqueur. */
export function presenterMessage(message: Message): { auteur: string; texte: string; assistant: boolean } {
  const assistant = message.texte.startsWith(MARQUEUR_ASSISTANT)
  return {
    auteur: assistant ? 'ADA' : message.auteur,
    // Les choix sont présentés dans le formulaire de réponse : on ne les répète pas dans le fil.
    texte: assistant
      ? message.texte
          .replace(MARQUEUR_ASSISTANT, '')
          .replace(DONNEES_CHOIX, '')
          .replace(BLOC_CHOIX_LISIBLE, '')
          .replace(DONNEES_DECOUPAGE, '')
          .replace(BLOC_DECOUPAGE_LISIBLE, '')
          // Réponse en conversation : le titre « 🤖 ADA » redit l'auteur, déjà affiché.
          .replace(/^\s*🤖 \*\*ADA\*\*\s*/, '')
          .trim()
      : message.texte,
    assistant,
  }
}

export interface Controle {
  nom: string
  /** « non-lance » : GitHub a refusé de lancer le contrôle (facturation du compte), le code n'est pas en cause. */
  etat: 'en-attente' | 'en-cours' | 'reussi' | 'echec' | 'non-lance'
  lien: string | null
}

/** Vérification d'une demande réalisée : PR, contrôles de la CI, fusion possible ou non. */
export interface Verification {
  pullRequest: { numero: number; url: string; etat: 'ouverte' | 'fusionnee' | 'fermee' } | null
  controles: Controle[]
  fusionnable: boolean
  raison: string | null
}

export const LIBELLES_CONTROLE: Record<Controle['etat'], string> = {
  'en-attente': 'en attente',
  'en-cours': 'en cours',
  reussi: 'réussi',
  echec: 'échoué',
  'non-lance': 'non lancé par GitHub',
}

export const PROMPT_MIN = 10
export const PROMPT_MAX = 1000
