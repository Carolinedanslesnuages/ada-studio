export class ErreurApi extends Error {
  constructor(
    public readonly statut: number,
    message: string,
    public readonly erreurs: Record<string, string> = {},
  ) {
    super(message)
  }
}

async function appeler<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const reponse = await fetch(`/api${chemin}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  })
  const texte = await reponse.text()
  let donnees: { message?: unknown; erreurs?: Record<string, string> } | null = null
  try {
    donnees = texte ? JSON.parse(texte) : null
  } catch {
    donnees = null // page d'erreur HTML (proxy) : pas de JSON
  }
  if (!reponse.ok) {
    // ADA momentanément indisponible (redémarrage, mise à jour) : message clair, jamais un code brut.
    if ([502, 503, 504].includes(reponse.status)) {
      throw new ErreurApi(
        reponse.status,
        'ADA redémarre un instant. Votre action a peut-être déjà été prise en compte : vérifiez dans quelques secondes avant de réessayer.',
      )
    }
    const message =
      typeof donnees?.message === 'string' ? donnees.message : `Erreur ${reponse.status}`
    const erreurs = (donnees?.message as { erreurs?: Record<string, string> } | undefined)?.erreurs ?? donnees?.erreurs
    throw new ErreurApi(reponse.status, message, erreurs)
  }
  return donnees as T
}

export const api = {
  lire: <T>(chemin: string) => appeler<T>(chemin),
  envoyer: <T>(chemin: string, corps: unknown) =>
    appeler<T>(chemin, { method: 'POST', body: JSON.stringify(corps) }),
}
