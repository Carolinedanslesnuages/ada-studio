import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFormulaireStore } from '../formulaire'
import { FORMULAIRE_ESSAI, reponseJson } from '@/__tests__/donnees'

describe('Magasin du formulaire', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.unstubAllGlobals())

  it('charge la définition une seule fois, pour tous les écrans', async () => {
    const appel = vi.fn<typeof fetch>(async () => reponseJson(FORMULAIRE_ESSAI))
    vi.stubGlobal('fetch', appel)
    const magasin = useFormulaireStore()
    await magasin.charger()
    await magasin.charger()
    expect(magasin.formulaire).toEqual(FORMULAIRE_ESSAI)
    expect(appel).toHaveBeenCalledTimes(1)
  })

  it('explique simplement quand le serveur ne répond pas', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => reponseJson({}, 500)))
    const magasin = useFormulaireStore()
    await magasin.charger()
    expect(magasin.formulaire).toBeNull()
    expect(magasin.erreur).toMatch(/n’a pas pu être chargé/)
  })
})
