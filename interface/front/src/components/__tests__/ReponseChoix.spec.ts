import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Ui from '@/components/ui'
import ReponseChoix from '../ReponseChoix.vue'
import type { QuestionAChoix } from '@/lib/story'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const QUESTIONS: QuestionAChoix[] = [
  { question: 'Retour le jour même ?', choix: ['Oui', 'Non'], plusieurs: false },
  { question: 'Quelles colonnes afficher ?', choix: ['Nom', 'Date', 'Emprunteur'], plusieurs: true },
]
const monter = () => mount(ReponseChoix, { props: { questions: QUESTIONS }, global: { plugins: [Ui] }, attachTo: document.body })
const cliquer = async (wrapper: ReturnType<typeof monter>, texte: string, rang: number) => {
  const etiquette = wrapper.findAll('label').find((element) => element.text().startsWith(texte) && element.attributes('for')?.startsWith(`choix-${rang}-`))!
  await wrapper.find(`#${etiquette.attributes('for')}`).trigger('click')
}

describe('Répondre en cochant', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('boutons radio pour une seule réponse, cases à cocher pour plusieurs, et une précision par question', () => {
    const wrapper = monter()
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('(plusieurs réponses possibles)')
    expect(wrapper.text()).toContain('Autre / précision pour la question 1 (facultatif)')
    wrapper.unmount()
  })

  it('demande une réponse à chaque question (une case ou une précision)', async () => {
    const wrapper = monter()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('repondre')).toBeUndefined()
    expect(wrapper.text()).toContain('Cochez une réponse, ou écrivez une précision')
    wrapper.unmount()
  })

  it('envoie les options cochées et la précision, en texte lisible', async () => {
    const wrapper = monter()
    await cliquer(wrapper, 'Non', 0)
    await cliquer(wrapper, 'Nom', 1)
    await cliquer(wrapper, 'Emprunteur', 1)
    const champs = wrapper.findAll('input[type="text"], input:not([type])')
    await champs[champs.length - 1]!.setValue('seulement sur ordinateur')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('repondre')?.[0]).toEqual([
      '1. Retour le jour même ?\n→ Non\n\n2. Quelles colonnes afficher ?\n→ Nom ; Emprunteur\nPrécision : seulement sur ordinateur',
    ])
    wrapper.unmount()
  })

  it('une précision seule suffit pour répondre à une question', async () => {
    const wrapper = monter()
    const champs = wrapper.findAll('input[type="text"], input:not([type])')
    await champs[0]!.setValue('ça dépend du matériel')
    await cliquer(wrapper, 'Date', 1)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('repondre')?.[0]?.[0]).toContain('1. Retour le jour même ?\nPrécision : ça dépend du matériel')
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité automatique, erreurs affichées comprises', async () => {
    const wrapper = monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await wrapper.find('form').trigger('submit')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('ne répète pas le numéro déjà écrit par ADA (« 1. 1. »)', () => {
    const wrapper = mount(ReponseChoix, {
      props: { questions: [{ question: '1. Les résolus restent-ils affichés ?', choix: ['Oui', 'Non'], plusieurs: false }] },
      global: { plugins: [Ui] },
    })
    expect(wrapper.text()).toContain('1. Les résolus restent-ils affichés ?')
    expect(wrapper.text()).not.toContain('1. 1.')
    wrapper.unmount()
  })
})
