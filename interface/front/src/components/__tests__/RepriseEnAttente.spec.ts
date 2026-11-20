import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Ui from '@/components/ui'
import RepriseEnAttente from '../RepriseEnAttente.vue'
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

const TITRE = 'Titre de PR (Conventional Commits, semver)'
const enAnalyse = { analyseEnCours: true, pullRequest: null, controles: [], fusionnable: false, raison: 'ADA analyse le projet' }
const pr = (fusionnable: boolean, etat: 'ouverte' | 'fusionnee' = 'ouverte') => ({
  analyseEnCours: false,
  pullRequest: { numero: 50, url: 'https://github.com/p/aminimo/pull/50', etat },
  controles: [{ nom: TITRE, etat: fusionnable ? 'reussi' : 'en-cours', lien: null }],
  fusionnable,
  raison: fusionnable ? null : 'Contrôles en cours…',
})

describe('Reprise en attente (#37)', () => {
  const monter = async () => {
    const wrapper = mount(RepriseEnAttente, { props: { projet: 'aminimo', intervalleSuivi: 20 }, global: { plugins: [Ui] }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  beforeEach(() => {
    lire.mockReset()
    envoyer.mockReset()
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('pendant l’analyse : explique où suivre ADA, sans bouton de fusion', async () => {
    lire.mockResolvedValue(enAnalyse)
    const wrapper = await monter()
    expect(lire).toHaveBeenCalledWith('/projets/aminimo/reprise')
    expect(wrapper.text()).toContain('ADA analyse le projet comme si elle l’avait créé')
    expect(wrapper.text()).not.toContain('Valider et fusionner la reprise')
    wrapper.unmount()
  })

  it('suit l’analyse jusqu’à la PR, puis le PO valide et fusionne la reprise dans ADA', async () => {
    lire.mockResolvedValue(enAnalyse)
    const wrapper = await monter()
    lire.mockResolvedValue(pr(false))
    await new Promise((fin) => setTimeout(fin, 40))
    await flushPromises()
    const bouton = () => wrapper.findAll('button').find((b) => b.text() === 'Valider et fusionner la reprise')!
    expect(bouton().attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Contrôles en cours…')

    lire.mockResolvedValue(pr(true))
    await new Promise((fin) => setTimeout(fin, 40))
    await flushPromises()
    envoyer.mockResolvedValue(pr(false, 'fusionnee'))
    await bouton().trigger('click')
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/aminimo/reprise/fusionner', {})
    expect(wrapper.emitted('fusionnee')).toHaveLength(1)
    wrapper.unmount()
  })

  it('contrôle non lancé par GitHub : le PO peut le relancer depuis ADA', async () => {
    lire.mockResolvedValue({ ...pr(false), controles: [{ nom: TITRE, etat: 'non-lance', lien: null }], raison: 'GitHub n’a pas lancé les contrôles' })
    const wrapper = await monter()
    expect(wrapper.text()).toContain('non lancé par GitHub')
    envoyer.mockResolvedValue(pr(false))
    await wrapper.findAll('button').find((b) => b.text() === 'Relancer les contrôles')!.trigger('click')
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/aminimo/reprise/controles/relancer', {})
    wrapper.unmount()
  })

  it('analyse arrêtée sans PR : le PO est prévenu', async () => {
    lire.mockResolvedValue({ ...enAnalyse, analyseEnCours: false, raison: 'L’analyse s’est arrêtée sans pull request de reprise' })
    const wrapper = await monter()
    expect(wrapper.text()).toContain('L’analyse s’est arrêtée sans pull request de reprise')
    wrapper.unmount()
  })

  it('est accessible', async () => {
    lire.mockResolvedValue(pr(true))
    const wrapper = await monter()
    expect(await violationsAccessibilite(wrapper.element)).toEqual([])
    wrapper.unmount()
  })
})
