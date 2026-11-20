import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import EmpreinteProjet from '../EmpreinteProjet.vue'
import { api } from '@/services/api'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const monter = () =>
  mount(EmpreinteProjet, { props: { projet: 'proprio/poc' }, global: { stubs: { RouterLink: RouterLinkStub } }, attachTo: document.body })

describe('Empreinte d’un projet', () => {
  afterEach(() => vi.restoreAllMocks())

  it('affiche le total du projet, son équivalent et le nombre de demandes', async () => {
    const lire = vi.spyOn(api, 'lire').mockResolvedValue({
      empreinte: { co2g: { min: 64, max: 64 }, energieWh: { min: 1, max: 1 }, tokensSortie: 1, tokensEntree: 1 },
      demandes: 3,
      equivalents: { streamingHeureG: 64 },
    })
    const vue = monter()
    await flushPromises()
    expect(lire).toHaveBeenCalledWith('/projets/proprio%2Fpoc/empreinte')
    const texte = vue.get('[data-testid="empreinte-projet"]').text()
    expect(texte).toContain('64 g CO2e')
    expect(texte).toContain('1 h de streaming vidéo')
    expect(texte).toContain('3 demandes')
    expect(await violationsAccessibilite(vue.element)).toEqual([])
    vue.unmount()
  })

  it('n’affiche rien tant qu’ADA n’a pas travaillé sur le projet, ni en cas d’erreur', async () => {
    vi.spyOn(api, 'lire').mockResolvedValueOnce(null)
    const vide = monter()
    await flushPromises()
    expect(vide.find('[data-testid="empreinte-projet"]').exists()).toBe(false)
    vide.unmount()
    vi.spyOn(api, 'lire').mockRejectedValueOnce(new Error('hors ligne'))
    const erreur = monter()
    await flushPromises()
    expect(erreur.find('[data-testid="empreinte-projet"]').exists()).toBe(false)
    erreur.unmount()
  })
})
