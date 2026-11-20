import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Ui from '@/components/ui'
import LienDemo from '../LienDemo.vue'
import { api } from '@/services/api'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

vi.mock('@/services/api', async (original) => ({
  ...(await original<typeof import('@/services/api')>()),
  api: { lire: vi.fn<(chemin: string) => Promise<unknown>>(), envoyer: vi.fn<(chemin: string, corps: unknown) => Promise<unknown>>() },
}))
const lire = vi.mocked(api.lire)
const envoyer = vi.mocked(api.envoyer)

const monter = async (apercuPret: boolean) => {
  const wrapper = mount(LienDemo, { props: { projet: 'pret-de-materiel', apercuPret, intervalleMs: 0 }, global: { plugins: [Ui] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const bouton = (wrapper: Awaited<ReturnType<typeof monter>>) => wrapper.find('button')

describe('Lien de démonstration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('aperçu non démarré : bouton désactivé, et ADA explique pourquoi', async () => {
    const wrapper = await monter(false)
    expect(bouton(wrapper).text()).toBe('Copier le lien de démonstration')
    expect(bouton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Disponible quand l’aperçu du projet est démarré.')
    expect(lire).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('prépare la démo à la demande, puis propose de copier le lien', async () => {
    lire.mockResolvedValueOnce({ etat: 'arrete', url: null, apercuDemarre: true }).mockResolvedValue({ etat: 'pret', url: 'https://pret-de-materiel.demo.ada.gouv.fr', apercuDemarre: true })
    envoyer.mockResolvedValue({ etat: 'demarrage', url: null, apercuDemarre: true })
    const wrapper = await monter(true)
    expect(bouton(wrapper).text()).toBe('Préparer le lien de démonstration')
    await bouton(wrapper).trigger('click')
    await flushPromises()
    await new Promise((fin) => setTimeout(fin, 5))
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/pret-de-materiel/demo', {})
    expect(bouton(wrapper).text()).toBe('Copier le lien de démonstration')
    expect(bouton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('copie le lien public, qui montre la dernière version validée, et l’annonce', async () => {
    const ecrire = vi.fn<(texte: string) => Promise<void>>(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true })
    lire.mockResolvedValue({ etat: 'pret', url: 'https://pret-de-materiel.demo.ada.gouv.fr', apercuDemarre: true })
    const wrapper = await monter(true)
    expect(wrapper.text()).toContain('dernière version validée')
    expect(wrapper.find('a[href="https://pret-de-materiel.demo.ada.gouv.fr"]').exists()).toBe(true)
    await bouton(wrapper).trigger('click')
    await flushPromises()
    expect(ecrire).toHaveBeenCalledWith('https://pret-de-materiel.demo.ada.gouv.fr')
    expect(wrapper.find('[role="status"]').text()).toBe('Lien copié : https://pret-de-materiel.demo.ada.gouv.fr')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité, bouton désactivé compris', async () => {
    const wrapper = await monter(false)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
