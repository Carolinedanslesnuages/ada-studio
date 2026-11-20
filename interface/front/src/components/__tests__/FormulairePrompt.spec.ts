import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Ui from '@/components/ui'
import FormulairePrompt from '../FormulairePrompt.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const monter = () => mount(FormulairePrompt, { global: { plugins: [Ui] }, attachTo: document.body })

describe('Prompter (mode libre)', () => {
  it('explique que c’est pour un petit changement, pas une application entière, avec plan à valider', async () => {
    const wrapper = monter()
    expect(wrapper.text()).toContain('Pas une application entière')
    expect(wrapper.text()).toContain('En envoyant, votre texte est enregistré tel quel sur GitHub, comme une demande « mode libre » du projet')
    const envoyer = wrapper.findAll('button').find((b) => b.text().includes('Envoyer'))!
    expect(envoyer.attributes('aria-describedby')).toBe('prompt-enregistrement')
    expect(wrapper.text()).toContain('plan à valider')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('envoie la demande nettoyée', async () => {
    const wrapper = monter()
    await wrapper.find('textarea').setValue('  Mets le titre en bleu  ')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('soumettre')?.[0]).toEqual(['Mets le titre en bleu'])
    wrapper.unmount()
  })

  it('refuse une demande vide ou démesurée', async () => {
    const wrapper = monter()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Décrivez votre demande')
    await wrapper.find('textarea').setValue('x'.repeat(1001))
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('écrivez des stories')
    expect(wrapper.emitted('soumettre')).toBeUndefined()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
