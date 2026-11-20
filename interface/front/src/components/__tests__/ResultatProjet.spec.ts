import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Ui from '@/components/ui'
import ResultatProjet from '../ResultatProjet.vue'
import type { ResultatCreation } from '@/lib/projet'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const resultat = (versions: 'fait' | 'a-faire', protection: 'fait' | 'a-faire'): ResultatCreation => ({
  projet: { id: 'annuaire', nom: 'annuaire', proprietaire: 'p', compte: 'organisation' as const, reprise: null, repris: false, description: null, prive: true, url: 'https://github.com/p/annuaire', misAJourLe: null },
  reglages: {
    versionsAutomatiques: { etat: versions, lien: 'https://github.com/p/annuaire/settings/actions' },
    protectionMain: { etat: protection, lien: 'https://github.com/p/annuaire/settings/rules' },
  },
})

const monter = (r: ResultatCreation) =>
  mount(ResultatProjet, { props: { resultat: r }, global: { plugins: [Ui] }, attachTo: document.body })

describe('Résultat de la création de projet', () => {
  it('n’affiche aucune consigne quand GitHub a tout accepté', () => {
    const wrapper = monter(resultat('fait', 'fait'))
    expect(wrapper.text()).toContain('Versions automatiques : activées')
    expect(wrapper.text()).not.toContain('Workflow permissions')
    wrapper.unmount()
  })

  it('guide le PO, avec le bon lien, pour les réglages refusés', async () => {
    const wrapper = monter(resultat('a-faire', 'a-faire'))
    expect(wrapper.text()).toContain('Workflow permissions')
    expect(wrapper.find('a[href="https://github.com/p/annuaire/settings/actions"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('compte personnel gratuit')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('propose d’écrire la première story', async () => {
    const wrapper = monter(resultat('fait', 'fait'))
    await wrapper.findAll('button').find((b) => b.text().includes('première story'))!.trigger('click')
    expect(wrapper.emitted('fermer')).toHaveLength(1)
    wrapper.unmount()
  })

  it('annonce que l’idée est enregistrée et que ADA l’étudie (#68)', async () => {
    const wrapper = monter({ ...resultat('fait', 'fait'), idee: 1 })
    expect(wrapper.text()).toContain('Votre idée est enregistrée (demande n° 1)')
    await wrapper.findAll('button').find((b) => b.text().includes('Suivre ADA'))!.trigger('click')
    expect(wrapper.emitted('suivre')).toEqual([[1]])
    expect(wrapper.text()).not.toContain('Écrire la première story')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
