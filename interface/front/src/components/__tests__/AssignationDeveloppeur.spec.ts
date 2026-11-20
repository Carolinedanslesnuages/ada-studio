import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Ui from '@/components/ui'
import AssignationDeveloppeur from '../AssignationDeveloppeur.vue'
import { api } from '@/services/api'
import type { DetailStory } from '@/lib/story'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

vi.mock('@/services/api', async (original) => ({
  ...(await original<typeof import('@/services/api')>()),
  api: { lire: vi.fn<(chemin: string) => Promise<unknown>>(), envoyer: vi.fn<(chemin: string, corps: unknown) => Promise<unknown>>() },
}))
const lire = vi.mocked(api.lire)
const envoyer = vi.mocked(api.envoyer)

const story = (extra: Partial<DetailStory> = {}): DetailStory => ({
  numero: 7,
  type: 'story',
  titre: 'Rendre un objet',
  statut: 'besoin-dev',
  creeeLe: '',
  fermeeLe: null,
  url: '',
  prete: true,
  raison: null,
  assignes: [],
  contenu: null,
  contenuBug: null,
  contenuLibre: null,
  texteBrut: '',
  messages: [],
  ...extra,
})

const monter = (demande: DetailStory) =>
  mount(AssignationDeveloppeur, { props: { projet: 'pret', story: demande }, global: { plugins: [Ui] }, attachTo: document.body })

describe('Assigner un développeur', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('n’apparaît que pour une demande bloquée (ou déjà assignée)', () => {
    const enCours = monter(story({ statut: 'en-cours' }))
    expect(enCours.find('section').exists()).toBe(false)
    enCours.unmount()
    const bloquee = monter(story())
    expect(bloquee.find('button').text()).toBe('Assigner un développeur')
    bloquee.unmount()
  })

  it('propose les personnes qui ont accès au dépôt, puis assigne celle choisie', async () => {
    lire.mockResolvedValue([{ login: 'dev-a', avatar: null }, { login: 'dev-b', avatar: null }])
    envoyer.mockResolvedValue(story({ assignes: [{ login: 'dev-b', avatar: null }] }))
    const wrapper = monter(story())
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(lire).toHaveBeenCalledWith('/projets/pret/stories/developpeurs')
    const options = wrapper.findAll('option').map((option) => option.text())
    expect(options).toEqual(['Choisir un développeur', 'dev-a', 'dev-b'])
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await wrapper.find('select').setValue('dev-b')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/pret/stories/7/assigner', { login: 'dev-b' })
    wrapper.unmount()
  })

  it('affiche le développeur assigné, et permet de changer ou de retirer l’assignation', async () => {
    envoyer.mockResolvedValue(story())
    const wrapper = monter(story({ assignes: [{ login: 'dev-a', avatar: null }] }))
    expect(wrapper.find('[role="status"]').text()).toBe('Assignée à dev-a sur GitHub.')
    const boutons = wrapper.findAll('button').map((bouton) => bouton.text())
    expect(boutons).toEqual(['Changer de développeur', 'Retirer l’assignation'])
    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/pret/stories/7/assigner', { login: null })
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
