import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Ui from '@/components/ui'
import StoriesLivrees from '../StoriesLivrees.vue'
import type { ResumeStory } from '@/lib/story'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const livree = (numero: number): ResumeStory => ({
  numero,
  type: 'story',
  titre: `Story ${numero}`,
  statut: 'livree',
  creeeLe: '2026-11-01T10:00:00Z',
  fermeeLe: '2026-11-16T10:00:00Z',
  url: '',
  prete: true,
  raison: null,
})

const monter = (nombre: number) =>
  mount(StoriesLivrees, {
    props: { stories: Array.from({ length: nombre }, (_, rang) => livree(nombre - rang)), urlDepot: 'https://github.com/proprio/poc' },
    global: { plugins: [Ui] },
    attachTo: document.body,
  })

describe('Section « Déjà livrées »', () => {
  it('est repliée par défaut et annonce le nombre de stories livrées', () => {
    const wrapper = monter(3)
    const bouton = wrapper.find('button[aria-expanded]')
    expect(bouton.text()).toBe('Déjà livrées (3)')
    expect(bouton.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('montre au plus les 10 dernières, et un lien vers toutes les issues fermées sur GitHub', async () => {
    const wrapper = monter(12)
    await wrapper.find('button[aria-expanded]').trigger('click')
    expect(wrapper.findAll('ul[aria-label="Stories déjà livrées"] li')).toHaveLength(10)
    expect(wrapper.text()).toContain('Les 10 dernières livrées.')
    const lien = wrapper.find('a[href*="/issues?q="]')
    expect(lien.attributes('href')).toBe('https://github.com/proprio/poc/issues?q=is%3Aissue%20is%3Aclosed')
    expect(lien.text()).toContain('Voir tout sur GitHub')
    wrapper.unmount()
  })

  it('ouvre une story livrée au clic', async () => {
    const wrapper = monter(2)
    await wrapper.find('button[aria-expanded]').trigger('click')
    await wrapper.find('ul[aria-label="Stories déjà livrées"] button').trigger('click')
    expect(wrapper.emitted('ouvrir')).toEqual([[2]])
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité automatique, repliée comme dépliée', async () => {
    const wrapper = monter(2)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await wrapper.find('button[aria-expanded]').trigger('click')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
