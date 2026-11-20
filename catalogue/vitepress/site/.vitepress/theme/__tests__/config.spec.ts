// @vitest-environment node
import { describe, expect, it } from 'vitest'
import config from '../../config.mts'

describe('Réglages du site', () => {
  it('site en français, liens morts refusés, recherche intégrée', () => {
    expect(config.lang).toBe('fr-FR')
    expect(config.ignoreDeadLinks).toBe(false)
    expect(config.themeConfig?.search?.provider).toBe('local')
  })

  it('libellés de navigation en français (lecteurs d’écran compris)', () => {
    expect(config.themeConfig?.skipToContentLabel).toBe('Aller au contenu')
    expect(config.themeConfig?.outline).toMatchObject({ label: 'Sur cette page' })
    expect(config.themeConfig?.sidebarMenuLabel).toBe('Menu')
  })

  it('sans les éléments du thème qui posent problème d’accessibilité (bouton sans nom, double pied de page)', () => {
    expect(config.appearance).toBe(false)
    expect(config.themeConfig?.docFooter).toEqual({ prev: false, next: false })
  })
})
