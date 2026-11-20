import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Ui from '@/components/ui'
import PropositionDecoupage from '../PropositionDecoupage.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const STORIES = [
  { titre: 'Voir le matériel', role: 'agent', besoin: 'voir la liste', benefice: 'savoir', criteres: ['Liste'] },
  { titre: 'Emprunter', role: 'agent', besoin: 'emprunter', benefice: 'éviter Excel', criteres: ['Bouton'] },
  { titre: 'Rendre', role: 'agent', besoin: 'rendre', benefice: 'libérer', criteres: ['Bouton Rendre'] },
]
const monter = () =>
  mount(PropositionDecoupage, { props: { stories: STORIES, designation: 'la demande n° 4' }, global: { plugins: [Ui] }, attachTo: document.body })
const champ = (wrapper: ReturnType<typeof monter>, libelle: string) => {
  const etiquette = wrapper.findAll('label').find((element) => element.text().startsWith(libelle))!
  return wrapper.find(`#${etiquette.attributes('for')}`)
}

describe('Proposition de découpage', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('une story qui recoupe une story existante arrive décochée, avec un avertissement', async () => {
    const stories = [STORIES[0]!, { ...STORIES[1]!, doublonDe: 31 }, STORIES[2]!]
    const wrapper = mount(PropositionDecoupage, { props: { stories, designation: 'la demande n° 4' }, global: { plugins: [Ui] }, attachTo: document.body })
    const cases = wrapper.findAll('input[type="checkbox"]')
    expect(cases.map((caseACocher) => (caseACocher.element as HTMLInputElement).checked)).toEqual([true, false, true])
    expect(wrapper.text()).toContain('Une story ressemble à une story déjà écrite : je ne l’ai pas cochée.')
    expect(wrapper.find('#story-proposee-1-doublon').text()).toContain('Ressemble à la story n° 31, déjà dans le projet')
    expect(cases[1]!.attributes('aria-describedby')).toBe('story-proposee-1-doublon')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Publier les 2 stories sur GitHub')
    expect(await violationsAccessibilite(wrapper.element)).toEqual([])
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('creer')).toEqual([[[STORIES[0], STORIES[2]]]])
    wrapper.unmount()
  })

  it('court à lire : seuls les titres, cochés ; le détail est replié', () => {
    const wrapper = monter()
    const cases = wrapper.findAll('input[type="checkbox"]')
    expect(cases.map((caseACocher) => (caseACocher.element as HTMLInputElement).checked)).toEqual([true, true, true])
    expect(wrapper.findAll('label').filter((etiquette) => etiquette.text().startsWith('Publier')).map((etiquette) => etiquette.text())).toEqual([
      'Publier « Voir le matériel »',
      'Publier « Emprunter »',
      'Publier « Rendre »',
    ])
    expect(wrapper.findAll('button[aria-expanded="true"]')).toHaveLength(0)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Publier les 3 stories sur GitHub')
    wrapper.unmount()
  })

  it('champs préremplis : le PO corrige, décoche, et ne fait que valider', async () => {
    const wrapper = monter()
    await wrapper.find('#story-proposee-1').setValue(false)
    await champ(wrapper, 'Critères d’acceptation (story 3)').setValue('Bouton Rendre\n- Message de confirmation')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('creer')).toEqual([
      [
        [
          STORIES[0],
          { titre: 'Rendre', role: 'agent', besoin: 'rendre', benefice: 'libérer', criteres: ['Bouton Rendre', 'Message de confirmation'] },
        ],
      ],
    ])
    wrapper.unmount()
  })

  it('signale une story incomplète, l’ouvre, et ne publie rien', async () => {
    const wrapper = monter()
    await champ(wrapper, 'Je veux (story 2)').setValue('  ')
    await champ(wrapper, 'Critères d’acceptation (story 3)').setValue('a\nb\nc\nd\ne')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('creer')).toBeUndefined()
    const alertes = wrapper.findAll('[role="alert"]').map((alerte) => alerte.text()).filter(Boolean)
    expect(alertes).toEqual(['Story 2 : Complétez « je veux »', 'Story 3 : De 1 à 4 critères d’acceptation, un par ligne'])
    wrapper.unmount()
  })

  it('refuse de publier sans story cochée, et permet de demander un autre découpage', async () => {
    const wrapper = monter()
    for (const rang of [0, 1, 2]) await wrapper.find(`#story-proposee-${rang}`).setValue(false)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Cochez au moins une story')
    await wrapper.findAll('button').find((bouton) => bouton.text() === 'Demander un autre découpage')!.trigger('click')
    expect(wrapper.emitted('autreDecoupage')).toHaveLength(1)
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité automatique, détail ouvert compris', async () => {
    const wrapper = monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await wrapper.findAll('button[aria-expanded]')[0]!.trigger('click')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
