import { describe, it, expect, vi, afterEach } from 'vitest'
import { api, ErreurApi } from '../api'

const repondre = (status: number, corps: string) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(corps, { status }))

describe('Client de l’API d’ADA', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([502, 503, 504])('explique simplement une indisponibilité (%i), sans code brut', async (status) => {
    repondre(status, '<html>Bad Gateway</html>')
    const erreur = await api.envoyer('/projets/poc/versions/publier', {}).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurApi)
    expect((erreur as ErreurApi).message).toMatch(/ADA redémarre un instant/)
    expect((erreur as ErreurApi).message).not.toMatch(/50\d/)
  })

  it('garde le message métier de l’API et les erreurs de validation', async () => {
    repondre(409, JSON.stringify({ message: 'Aucune nouvelle version à publier' }))
    await expect(api.envoyer('/x', {})).rejects.toThrow('Aucune nouvelle version à publier')
    repondre(400, JSON.stringify({ message: { erreurs: { nom: 'Nom pris' } } }))
    const erreur = (await api.envoyer('/x', {}).catch((e: unknown) => e)) as ErreurApi
    expect(erreur.erreurs).toEqual({ nom: 'Nom pris' })
  })
})
