import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReponsesView from '../ReponsesView.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import { FORMULAIRE_ESSAI, reponseJson } from '@/__tests__/donnees'
import type { Reponse } from '@/services/formulaire'

const REPONSES: Reponse[] = [
  { id: 2, recueillieLe: '2026-11-16T14:05:00.000Z', valeurs: { nom: 'Lou Bernard', courriel: 'lou@exemple.fr', service: 'RH', sujets: ['Formation', 'Équipement'] } },
  { id: 1, recueillieLe: '2026-11-15T09:00:00.000Z', valeurs: { nom: 'Camille Martin', courriel: 'camille@exemple.fr', service: 'Informatique' } },
]

const simulerServeur = (reponses: Reponse[] | null) =>
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (adresse) => {
      if (String(adresse) === '/api/formulaire') return reponseJson(FORMULAIRE_ESSAI)
      return reponses ? reponseJson(reponses) : reponseJson({}, 500)
    }),
  )

const monter = async () => {
  const wrapper = mount(ReponsesView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('Page « Réponses »', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('présente les réponses dans un tableau titré, une colonne par question', async () => {
    simulerServeur(REPONSES)
    const wrapper = await monter()
    expect(wrapper.find('caption').text()).toContain('Réponses reçues')
    const entetes = wrapper.findAll('th').map((entete) => entete.text())
    expect(entetes).toEqual(['N°', 'Reçue le', 'Nom et prénom', 'Adresse électronique', 'Votre service', 'Sujets', 'Votre message'])
    expect(wrapper.text()).toContain('Formation, Équipement')
    expect(wrapper.text()).toContain('16/11/2026 15:05')
    expect(wrapper.text()).toContain('2 réponse(s) reçue(s).')
    wrapper.unmount()
  })

  it('propose l’export CSV', async () => {
    simulerServeur(REPONSES)
    const wrapper = await monter()
    const lien = wrapper.find('a[download]')
    expect(lien.attributes('href')).toBe('/api/reponses.csv')
    expect(lien.text()).toContain('Exporter les réponses (CSV')
    wrapper.unmount()
  })

  it('sans réponse : ni tableau ni export', async () => {
    simulerServeur([])
    const wrapper = await monter()
    expect(wrapper.text()).toContain('0 réponse(s) reçue(s).')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('a[download]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('explique simplement quand le serveur ne répond pas', async () => {
    simulerServeur(null)
    const wrapper = await monter()
    expect(wrapper.text()).toContain('n’ont pas pu être chargées')
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité automatique', async () => {
    simulerServeur(REPONSES)
    const wrapper = await monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
