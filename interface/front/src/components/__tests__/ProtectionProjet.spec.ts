import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Ui from '@/components/ui'
import ProtectionProjet from '../ProtectionProjet.vue'
import { api } from '@/services/api'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const monter = (projet = 'gladys') => mount(ProtectionProjet, { props: { projet }, global: { plugins: [Ui] }, attachTo: document.body })

describe('Protection de la branche principale (ouverture d’un projet)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('demande à ADA de vérifier la protection du projet ouvert', async () => {
    const envoyer = vi.spyOn(api, 'envoyer').mockResolvedValue({ etat: 'protegee', raison: null, lien: 'x' })
    const wrapper = monter('mon~poc')
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/mon~poc/protection', {})
    expect(wrapper.text()).toBe('') // déjà protégée : rien à dire
    wrapper.unmount()
  })

  it('prévient quand ADA vient de la protéger', async () => {
    vi.spyOn(api, 'envoyer').mockResolvedValue({ etat: 'posee', raison: null, lien: 'x' })
    const wrapper = monter()
    await flushPromises()
    expect(wrapper.text()).toContain('ADA vient de protéger la branche principale')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('avertit, avec la raison et le lien vers les règles, quand GitHub ne le permet pas', async () => {
    vi.spyOn(api, 'envoyer').mockResolvedValue({
      etat: 'impossible',
      raison: 'GitHub ne permet pas de protéger un dépôt privé sur un compte personnel gratuit.',
      lien: 'https://github.com/proprio/signalements/rules',
    })
    const wrapper = monter('signalements')
    await flushPromises()
    expect(wrapper.text()).toContain('n’est pas protégée')
    expect(wrapper.text()).toContain('dépôt privé sur un compte personnel gratuit')
    expect(wrapper.find('a').attributes('href')).toBe('https://github.com/proprio/signalements/rules')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('ne dit rien si la vérification échoue (elle sera refaite à la prochaine ouverture)', async () => {
    vi.spyOn(api, 'envoyer').mockRejectedValue(new Error('réseau'))
    const wrapper = monter('autre')
    await flushPromises()
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })

  describe('projet repris : ADA propose, le PO décide', () => {
    const bouton = (wrapper: ReturnType<typeof monter>, texte: string) => wrapper.findAll('button').find((b) => b.text().includes(texte))

    it('propose de protéger la branche, en prévenant des conséquences pour l’équipe', async () => {
      vi.spyOn(api, 'envoyer').mockResolvedValue({ etat: 'a-proposer', raison: null, lien: 'x' })
      const wrapper = monter('secret-santa')
      await flushPromises()
      expect(wrapper.text()).toContain('Protéger la branche principale ?')
      expect(wrapper.text()).toContain('prévenez-les')
      expect(bouton(wrapper, 'Protéger la branche')).toBeTruthy()
      expect(bouton(wrapper, 'Ne pas protéger')).toBeTruthy()
      expect(await violationsAccessibilite(document.body)).toEqual([])
      wrapper.unmount()
    })

    it('« Protéger la branche » : ADA la protège et le dit', async () => {
      const envoyer = vi.spyOn(api, 'envoyer').mockResolvedValueOnce({ etat: 'a-proposer', raison: null, lien: 'x' }).mockResolvedValueOnce({ etat: 'posee', raison: null, lien: 'x' })
      const wrapper = monter('secret-santa')
      await flushPromises()
      await bouton(wrapper, 'Protéger la branche')!.trigger('click')
      await flushPromises()
      expect(envoyer).toHaveBeenLastCalledWith('/projets/secret-santa/protection/poser', {})
      expect(wrapper.text()).toContain('ADA vient de protéger la branche principale')
      wrapper.unmount()
    })

    it('« Ne pas protéger » : le choix est retenu, et l’on peut y revenir', async () => {
      const envoyer = vi.spyOn(api, 'envoyer').mockResolvedValueOnce({ etat: 'a-proposer', raison: null, lien: 'x' }).mockResolvedValueOnce({ etat: 'refusee', raison: null, lien: 'x' })
      const wrapper = monter('secret-santa')
      await flushPromises()
      await bouton(wrapper, 'Ne pas protéger')!.trigger('click')
      await flushPromises()
      expect(envoyer).toHaveBeenLastCalledWith('/projets/secret-santa/protection/refuser', {})
      expect(wrapper.text()).toContain('Branche principale non protégée, à votre demande.')
      expect(wrapper.text()).not.toContain('Protéger la branche principale ?')
      expect(await violationsAccessibilite(document.body)).toEqual([])
      await bouton(wrapper, 'Revenir sur ce choix')!.trigger('click')
      expect(wrapper.text()).toContain('Protéger la branche principale ?')
      wrapper.unmount()
    })

    it('GitHub refuse la protection demandée : la raison s’affiche', async () => {
      vi.spyOn(api, 'envoyer')
        .mockResolvedValueOnce({ etat: 'a-proposer', raison: null, lien: 'x' })
        .mockResolvedValueOnce({ etat: 'impossible', raison: 'GitHub ne permet pas de protéger un dépôt privé sur un compte personnel gratuit.', lien: 'x' })
      const wrapper = monter('secret-santa')
      await flushPromises()
      await bouton(wrapper, 'Protéger la branche')!.trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('dépôt privé sur un compte personnel gratuit')
      wrapper.unmount()
    })
  })
})
