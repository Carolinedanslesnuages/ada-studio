import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Ui from '@/components/ui'
import PanneauApercu from '../PanneauApercu.vue'
import { api } from '@/services/api'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

vi.mock('@/services/api', async (original) => ({
  ...(await original<typeof import('@/services/api')>()),
  api: {
    lire: vi.fn<(chemin: string) => Promise<unknown>>(),
    envoyer: vi.fn<(chemin: string, corps: unknown) => Promise<unknown>>(),
  },
}))
const lire = vi.mocked(api.lire)
const envoyer = vi.mocked(api.envoyer)

const monter = (projet: string | null) =>
  mount(PanneauApercu, { props: { projet, intervalleMs: 1 }, global: { plugins: [Ui] }, attachTo: document.body })

describe('Panneau d’aperçu', () => {
  beforeEach(() => {
    lire.mockReset()
    envoyer.mockReset()
  })

  it('démarre l’aperçu du projet, attend qu’il réponde, puis affiche l’application', async () => {
    envoyer.mockResolvedValue({ etat: 'demarrage', url: null, journal: null })
    lire.mockResolvedValueOnce({ etat: 'demarrage', url: null, journal: null }).mockResolvedValue({
      etat: 'pret',
      url: 'http://localhost:5300',
      journal: null,
    })
    const wrapper = monter('poc-portail')
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/poc-portail/apercu', {})
    expect(wrapper.text()).toContain('Préparation de l’aperçu')
    await vi.waitFor(() => expect(wrapper.find('iframe').exists()).toBe(true))
    const cadre = wrapper.find('iframe')
    expect(cadre.attributes('src')).toBe('http://localhost:5300')
    expect(cadre.attributes('title')).toBe('Aperçu de l’application poc-portail')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('onglets « Produit » et « Composants » : le second affiche le Storybook du projet', async () => {
    envoyer.mockImplementation(async (chemin: string) =>
      chemin.endsWith('/composants') ? { etat: 'demarrage', url: null } : { etat: 'pret', url: 'http://localhost:5710', journal: null },
    )
    lire.mockImplementation(async (chemin: string) =>
      chemin.endsWith('/composants') ? { etat: 'pret', url: 'http://localhost:5770' } : { etat: 'pret', url: 'http://localhost:5710', journal: null },
    )
    const wrapper = monter('poc-portail')
    await flushPromises()
    const onglets = wrapper.findAll('[role="tab"]')
    expect(onglets.map((onglet) => onglet.text())).toEqual(['Produit', 'Composants'])
    expect(onglets[0]!.attributes('aria-selected')).toBe('true')
    await onglets[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('#panneau-composants iframe').attributes('src')).toBe('http://localhost:5770')
    await onglets[1]!.trigger('keydown', { key: 'ArrowRight' })
    expect(onglets[0]!.attributes('aria-selected')).toBe('true')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('montre le journal et propose de réessayer si l’application ne démarre pas', async () => {
    envoyer.mockResolvedValue({ etat: 'erreur', url: null, journal: 'npm ERR! code 1' })
    const wrapper = monter('poc-portail')
    await flushPromises()
    expect(wrapper.text()).toContain('L’application ne démarre pas')
    expect(wrapper.text()).toContain('npm ERR! code 1')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Réessayer')).toBe(true)
    wrapper.unmount()
  })

  it('reprise à valider : n’essaie pas de démarrer, explique pourquoi (#37)', () => {
    const wrapper = mount(PanneauApercu, {
      props: { projet: 'aminimo', enAttente: 'L’aperçu démarrera une fois la reprise validée.' },
      global: { plugins: [Ui] },
      attachTo: document.body,
    })
    expect(wrapper.text()).toContain('L’aperçu démarrera une fois la reprise validée.')
    expect(envoyer).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('donne signe de vie tant qu’il est affiché, et se relance s’il a été mis en veille', async () => {
    vi.useFakeTimers()
    try {
      envoyer.mockResolvedValue({ etat: 'pret', url: 'http://localhost:5300', journal: null })
      lire.mockResolvedValue({ etat: 'arrete', url: null, journal: null })
      const lecturesApercu = () => lire.mock.calls.filter(([chemin]) => chemin === '/projets/poc/apercu').length
      const demarrages = () => envoyer.mock.calls.filter(([chemin]) => chemin === '/projets/poc/apercu').length
      const wrapper = mount(PanneauApercu, { props: { projet: 'poc', signeDeVieMs: 60_000 }, global: { plugins: [Ui] } })
      await flushPromises()
      expect(demarrages()).toBe(1)
      expect(lecturesApercu()).toBe(0)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(lecturesApercu()).toBe(1)
      expect(demarrages()).toBe(2)
      wrapper.unmount()
      const appels = lecturesApercu()
      await vi.advanceTimersByTimeAsync(180_000)
      expect(lecturesApercu()).toBe(appels)
    } finally {
      vi.useRealTimers()
    }
  })

  it('invite à choisir un projet quand aucun n’est sélectionné', () => {
    const wrapper = monter(null)
    expect(wrapper.text()).toContain('Choisissez un projet')
    expect(envoyer).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
