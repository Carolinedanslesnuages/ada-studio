import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormulaireView from '../FormulaireView.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import { FORMULAIRE_ESSAI, reponseJson } from '@/__tests__/donnees'

type Appel = { adresse: string; methode: string; corps: unknown }

const simulerServeur = (reponseEnvoi: () => Response) => {
  const appels: Appel[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (adresse, options) => {
      appels.push({ adresse: String(adresse), methode: options?.method ?? 'GET', corps: options?.body ? JSON.parse(String(options.body)) : null })
      return String(adresse) === '/api/formulaire' ? reponseJson(FORMULAIRE_ESSAI) : reponseEnvoi()
    }),
  )
  return appels
}

const monter = async () => {
  const wrapper = mount(FormulaireView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('Écran du formulaire', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('affiche chaque question avec le composant adapté et signale les champs obligatoires', async () => {
    simulerServeur(() => reponseJson({ id: 1 }, 201))
    const wrapper = await monter()
    expect(wrapper.find('h1').text()).toBe('Inscription à l’atelier')
    expect(wrapper.find('input#question-nom').exists()).toBe(true)
    expect(wrapper.find('input#question-courriel').attributes('type')).toBe('email')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(wrapper.find('textarea#question-message').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nom et prénom (obligatoire)')
    expect(wrapper.text()).toContain('aucune donnée personnelle réelle')
    wrapper.unmount()
  })

  it('envoie les réponses saisies puis confirme, formulaire vidé', async () => {
    const appels = simulerServeur(() => reponseJson({ id: 7 }, 201))
    const wrapper = await monter()
    await wrapper.find('input#question-nom').setValue('Camille Martin')
    await wrapper.find('input#question-courriel').setValue('camille@exemple.fr')
    await wrapper.findAll('input[type="radio"]')[1]!.trigger('click')
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(appels[appels.length - 1]).toEqual({
      adresse: '/api/reponses',
      methode: 'POST',
      corps: { nom: 'Camille Martin', courriel: 'camille@exemple.fr', service: 'Informatique', sujets: ['Formation'] },
    })
    expect(wrapper.find('[role="status"]').text()).toContain('Merci, votre réponse a bien été enregistrée.')
    expect((wrapper.find('input#question-nom').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('affiche les erreurs du serveur sous chaque champ et dans un résumé qui prend le focus', async () => {
    simulerServeur(() =>
      reponseJson({ erreur: 'Le formulaire contient des erreurs', erreurs: { nom: 'Le champ « Nom et prénom » est obligatoire' } }, 400),
    )
    const wrapper = await monter()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const resume = wrapper.find('.alerte--erreur')
    expect(resume.text()).toContain('1 erreur(s)')
    expect(resume.find('a').attributes('href')).toBe('#question-nom')
    expect(document.activeElement).toBe(resume.element)
    expect(wrapper.text()).toContain('Le champ « Nom et prénom » est obligatoire')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('prévient sans perdre la saisie quand l’envoi échoue', async () => {
    simulerServeur(() => reponseJson({}, 500))
    const wrapper = await monter()
    await wrapper.find('input#question-nom').setValue('Camille')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('n’a pas pu être envoyée')
    expect((wrapper.find('input#question-nom').element as HTMLInputElement).value).toBe('Camille')
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité automatique', async () => {
    simulerServeur(() => reponseJson({ id: 1 }, 201))
    const wrapper = await monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
