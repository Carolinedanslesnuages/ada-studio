import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Ui from '@/components/ui'
import PanneauVersions from '../PanneauVersions.vue'
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

const proposee = (publiable: boolean, raison: string | null = null) => ({
  actuelle: null,
  proposee: {
    version: '0.2.0',
    numeroPr: 4,
    url: 'u',
    nouveautes: [{ texte: 'Page d’accueil', demande: 1 }],
    corrections: [],
    autres: [],
    publiable,
    raison,
  },
})

const monter = async () => {
  const wrapper = mount(PanneauVersions, { props: { projet: 'poc' }, global: { plugins: [Ui] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const bouton = (wrapper: Awaited<ReturnType<typeof monter>>, texte: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(texte))!

describe('Versions du projet', () => {
  beforeEach(() => {
    lire.mockReset()
    envoyer.mockReset()
  })

  it('montre le récapitulatif de la nouvelle version, puis la publie', async () => {
    lire.mockResolvedValue(proposee(true))
    envoyer.mockResolvedValue({ actuelle: { version: '0.2.0', url: 'u', le: null }, proposee: null })
    const wrapper = await monter()
    expect(wrapper.text()).toContain('aucune version publiée')
    await bouton(wrapper, 'Nouvelle version prête : 0.2.0').trigger('click')
    expect(wrapper.text()).toContain('Page d’accueil (story #1)')
    expect(wrapper.text()).toContain('Rien n’est mis en production')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await bouton(wrapper, 'Publier la version 0.2.0').trigger('click')
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/poc/versions/publier', {})
    expect(wrapper.text()).toContain('La version 0.2.0 est publiée')
    wrapper.unmount()
  })

  it('empêche la publication quand la version touche du code, et dit pourquoi', async () => {
    lire.mockResolvedValue(proposee(false, 'La version proposée modifie aussi d’autres fichiers (app.ts)'))
    const wrapper = await monter()
    await bouton(wrapper, 'Nouvelle version prête').trigger('click')
    expect(bouton(wrapper, 'Publier la version').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('modifie aussi d’autres fichiers')
    wrapper.unmount()
  })
})
