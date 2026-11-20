/** Échanges avec l'API du formulaire (api/src/routes/formulaire.ts). */
export type TypeQuestion =
  | 'texte'
  | 'texte-long'
  | 'courriel'
  | 'telephone'
  | 'nombre'
  | 'date'
  | 'choix-unique'
  | 'choix-multiple'

export interface Question {
  id: string
  libelle: string
  aide?: string
  type: TypeQuestion
  obligatoire: boolean
  choix?: string[]
  longueurMax?: number
}

export interface Formulaire {
  titre: string
  introduction: string
  messageConfirmation: string
  questions: Question[]
}

export type Valeur = string | number | string[]
export type Valeurs = Record<string, Valeur>

export interface Reponse {
  id: number
  recueillieLe: string
  valeurs: Valeurs
}

export type ResultatEnvoi = { ok: true; id: number } | { ok: false; erreurs: Record<string, string> }

/** Adresse de l'export CSV (lien de téléchargement direct). */
export const ADRESSE_EXPORT_CSV = '/api/reponses.csv'

async function lireJson<T>(adresse: string): Promise<T> {
  const reponse = await fetch(adresse, { headers: { Accept: 'application/json' } })
  if (!reponse.ok) throw new Error(`Le serveur ne répond pas correctement (${reponse.status})`)
  return (await reponse.json()) as T
}

export const lireFormulaire = () => lireJson<Formulaire>('/api/formulaire')
export const lireReponses = () => lireJson<Reponse[]>('/api/reponses')

export async function envoyerReponse(valeurs: Valeurs): Promise<ResultatEnvoi> {
  const reponse = await fetch('/api/reponses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(valeurs),
  })
  const corps = (await reponse.json()) as { id?: number; erreurs?: Record<string, string> }
  if (reponse.status === 400 && corps.erreurs) return { ok: false, erreurs: corps.erreurs }
  if (!reponse.ok || corps.id === undefined) throw new Error(`L’envoi a échoué (${reponse.status})`)
  return { ok: true, id: corps.id }
}
