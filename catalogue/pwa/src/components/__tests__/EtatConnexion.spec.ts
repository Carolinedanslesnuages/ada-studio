import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EtatConnexion from '../EtatConnexion.vue'

const definirEnLigne = (valeur: boolean) => Object.defineProperty(navigator, 'onLine', { value: valeur, configurable: true })

describe('État de la connexion', () => {
  afterEach(() => definirEnLigne(true))

  it('ne dit rien en ligne, prévient hors connexion, et se met à jour', async () => {
    definirEnLigne(true)
    const wrapper = mount(EtatConnexion, { attachTo: document.body })
    expect(wrapper.text()).toBe('')
    definirEnLigne(false)
    window.dispatchEvent(new Event('offline'))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').text()).toContain('Hors connexion : l’application continue de fonctionner')
    definirEnLigne(true)
    window.dispatchEvent(new Event('online'))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })
})
