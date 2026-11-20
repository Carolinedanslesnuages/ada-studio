import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import QuizView from '../QuizView.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const monter = () => mount(QuizView, { attachTo: document.body })
const bouton = (wrapper: ReturnType<typeof monter>, texte: string) => wrapper.findAll('button').find((element) => element.text().includes(texte))!

/** Répond à la question en cours en cliquant les choix donnés (par leur texte). */
async function repondre(wrapper: ReturnType<typeof monter>, textes: string[]) {
  for (const texte of textes) {
    const etiquette = wrapper.findAll('label').find((element) => element.text().startsWith(texte))!
    await wrapper.find(`#${etiquette.attributes('for')}`).trigger('click')
  }
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('Parcours du quiz', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('présente le quiz puis commence par la première question, focus sur son titre', async () => {
    const wrapper = monter()
    expect(wrapper.text()).toContain('3 questions')
    await bouton(wrapper, 'Commencer').trigger('click')
    await flushPromises()
    expect(wrapper.find('h2').text().replace(/\s+/g, ' ')).toBe('Question 1 Étape 1 sur 3')
    expect(document.activeElement).toBe(wrapper.find('h2').element)
    expect(wrapper.find('legend').text()).toContain('Une image qui transmet une information')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('refuse de valider sans réponse, avec un message clair', async () => {
    const wrapper = monter()
    await bouton(wrapper, 'Commencer').trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Choisissez une réponse')
    wrapper.unmount()
  })

  it('corrige chaque réponse avec son explication, puis donne le résultat et le récapitulatif', async () => {
    const wrapper = monter()
    await bouton(wrapper, 'Commencer').trigger('click')
    await repondre(wrapper, ['Une alternative textuelle'])
    expect(wrapper.text()).toContain('Bonne réponse')
    expect(document.activeElement?.textContent).toContain('Bonne réponse')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('legend').text()).toContain('(plusieurs réponses possibles)')
    await repondre(wrapper, ['Seulement une bordure rouge'])
    expect(wrapper.text()).toContain('Ce n’est pas la bonne réponse')
    expect(wrapper.text()).toContain('La bonne réponse : Un message écrit qui explique l’erreur'.replace('’', "'"))
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    await repondre(wrapper, ['Vrai'])
    expect(bouton(wrapper, 'Voir mon résultat')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('Votre résultat')
    expect(wrapper.text()).toContain('2 bonnes réponses sur 3 (67 %)')
    expect(wrapper.text()).toContain('Réussi')
    expect(wrapper.findAll('ol li strong').map((element) => element.text())).toEqual(['— Juste', '— À revoir', '— Juste'])
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await bouton(wrapper, 'Recommencer').trigger('click')
    await flushPromises()
    expect(wrapper.find('h2').text()).toContain('Étape 1 sur 3')
    wrapper.unmount()
  })
})
