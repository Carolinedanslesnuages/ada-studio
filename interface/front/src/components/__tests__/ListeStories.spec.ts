import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Ui from '@/components/ui'
import ListeStories from '../ListeStories.vue'
import type { ResumeStory } from '@/lib/story'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const story = (numero: number, statut: ResumeStory['statut'], titre: string, autres: Partial<ResumeStory> = {}): ResumeStory => ({
  numero, type: 'story', titre, statut, creeeLe: '', fermeeLe: null, url: '', prete: true, raison: null, ...autres,
})
const stories: ResumeStory[] = [
  story(2, 'en-cours', 'Filtre visio', { type: 'bug' }),
  story(1, 'livree', 'Salles libres'),
  story(3, 'nouvelle', 'Trop grosse', { prete: false, raison: 'Plus de 4 critères' }),
  story(4, 'nouvelle', 'Réserver une salle'),
]

const monter = (numeroCourant: number | null = null) =>
  mount(ListeStories, { props: { stories, numeroCourant }, global: { plugins: [Ui] }, attachTo: document.body })

const boutonStory = (wrapper: ReturnType<typeof monter>, numero: number) =>
  wrapper.findAll('button').find((bouton) => bouton.text().includes(`#${numero}`))

describe('Liste des stories', () => {
  it('signale la story ouverte et demande l’ouverture au clic', async () => {
    const wrapper = monter(1)
    expect(boutonStory(wrapper, 1)!.attributes('aria-current')).toBe('true')
    expect(boutonStory(wrapper, 2)!.attributes('aria-current')).toBeUndefined()
    expect(wrapper.text()).toContain('Livrée')
    expect(boutonStory(wrapper, 2)!.text()).toContain('Problème')
    await boutonStory(wrapper, 2)!.trigger('click')
    expect(wrapper.emitted('ouvrir')?.[0]).toEqual([2])
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('range les stories à lancer dans un accordéon fermé, avec leur nombre ; celles en cours restent visibles', async () => {
    const wrapper = monter()
    const accordeon = wrapper.find('button[aria-controls="stories-a-lancer"]')
    expect(accordeon.text()).toContain('À lancer (2)')
    expect(accordeon.attributes('aria-expanded')).toBe('false')
    expect(boutonStory(wrapper, 2)!.isVisible()).toBe(true)
    await accordeon.trigger('click')
    expect(accordeon.attributes('aria-expanded')).toBe('true')
    expect(boutonStory(wrapper, 3)!.text()).toContain('À corriger sur GitHub')
    await boutonStory(wrapper, 4)!.trigger('click')
    expect(wrapper.emitted('ouvrir')?.[0]).toEqual([4])
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('ouvre d’office l’accordéon quand la story affichée est à lancer', () => {
    const wrapper = monter(4)
    expect(wrapper.find('button[aria-controls="stories-a-lancer"]').attributes('aria-expanded')).toBe('true')
    expect(boutonStory(wrapper, 4)!.attributes('aria-current')).toBe('true')
    wrapper.unmount()
  })

  it('sans story à lancer, pas d’accordéon', () => {
    const wrapper = mount(ListeStories, { props: { stories: [stories[0]!] }, global: { plugins: [Ui] } })
    expect(wrapper.find('button[aria-controls="stories-a-lancer"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('range une demande en attente à la fin des stories à lancer, jamais conseillée', async () => {
    const liste: ResumeStory[] = [story(2, 'attente', 'Mode essai'), story(5, 'nouvelle', 'Envoyer')]
    const wrapper = mount(ListeStories, { props: { stories: liste }, global: { plugins: [Ui] }, attachTo: document.body })
    expect(wrapper.find('.prochaine-story').text()).toContain('#5')
    expect(wrapper.find('ul[aria-label="Stories en cours"]').exists()).toBe(false)
    await wrapper.find('button[aria-controls="stories-a-lancer"]').trigger('click')
    const lignes = wrapper.findAll('ol.liste-stories > li')
    expect(lignes.map((element) => Number(/#(\d+)/.exec(element.text())![1]))).toEqual([5, 2])
    expect(lignes[1]!.text()).toContain('En attente')
    wrapper.unmount()
  })

  it('conseille la prochaine story et range celles à lancer dans l’ordre conseillé', async () => {
    const aOrdonner: ResumeStory[] = [
      story(9, 'nouvelle', 'Récente, sans découpage'),
      story(7, 'nouvelle', 'Envoyer les e-mails', { parent: 4 }),
      story(6, 'nouvelle', 'Socle du site', { parent: 4 }),
      story(3, 'nouvelle', 'À corriger', { prete: false, raison: 'Plus de 4 critères' }),
      story(8, 'nouvelle', 'Bouton cassé', { type: 'bug' }),
    ]
    const wrapper = mount(ListeStories, { props: { stories: aOrdonner }, global: { plugins: [Ui] }, attachTo: document.body })
    const conseil = wrapper.find('.prochaine-story')
    expect(conseil.text()).toContain('Prochaine story conseillée')
    expect(conseil.text()).toContain('#8')
    await wrapper.find('button[aria-controls="stories-a-lancer"]').trigger('click')
    const ordre = wrapper.findAll('ol.liste-stories > li').map((element) => Number(/#(\d+)/.exec(element.text())![1]))
    expect(ordre).toEqual([8, 6, 7, 9, 3])
    await conseil.find('button').trigger('click')
    expect(wrapper.emitted('ouvrir')?.[0]).toEqual([8])
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
