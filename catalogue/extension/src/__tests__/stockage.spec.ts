import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { ecrire, lire } from '@/services/stockage'
import { simulerChromeStorage, simulerLocalStorage } from './donnees'

describe('Stockage de l’extension', () => {
  beforeEach(() => {
    simulerLocalStorage()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('utilise chrome.storage.local dans le navigateur', async () => {
    const { memoire } = simulerChromeStorage()
    await ecrire('reglages', { active: false })
    expect(memoire).toEqual({ reglages: { active: false } })
    expect(await lire('reglages', { active: true })).toEqual({ active: false })
    expect(window.localStorage.length).toBe(0)
  })

  it('se replie sur localStorage hors navigateur (aperçu d’ADA)', async () => {
    expect(await lire('reglages', { active: true })).toEqual({ active: true })
    await ecrire('reglages', { active: false })
    expect(await lire('reglages', { active: true })).toEqual({ active: false })
  })
})
