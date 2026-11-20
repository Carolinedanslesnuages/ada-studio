import { describe, it, expect, afterEach, vi } from 'vitest'
import { initialiser } from '@/background'
import { simulerChromeStorage } from './donnees'

describe('Arrière-plan', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('pose les réglages par défaut à l’installation', async () => {
    const { memoire } = simulerChromeStorage()
    await initialiser()
    expect(memoire).toEqual({ reglages: { active: true } })
  })

  it('garde les réglages de l’utilisateur lors d’une mise à jour', async () => {
    const { memoire } = simulerChromeStorage({ reglages: { active: false } })
    await initialiser()
    expect(memoire).toEqual({ reglages: { active: false } })
  })
})
