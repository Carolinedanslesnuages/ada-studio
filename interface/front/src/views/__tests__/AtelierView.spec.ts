import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Ui from '@/components/ui'
import AtelierView from '../AtelierView.vue'
import { api } from '@/services/api'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

vi.mock('@/services/api', async (original) => ({
  ...(await original<typeof import('@/services/api')>()),
  api: {
    lire: vi.fn<(chemin: string) => Promise<unknown>>(),
    envoyer: vi.fn<(chemin: string, corps: unknown) => Promise<unknown>>(),
  },
}))
const lire = vi.mocked(api.lire)
const envoyer = vi.mocked(api.envoyer)

const story = { numero: 1, type: 'story', titre: 'Page d’accueil', statut: 'nouvelle', creeeLe: '', url: '', prete: true, raison: null }

const reponses: Record<string, unknown> = {
  '/projets': [
    { id: 'poc-portail', nom: 'poc-portail', proprietaire: 'p', compte: 'organisation' as const, reprise: null, repris: false, description: null, prive: true, url: 'https://github.com/p/poc-portail', misAJourLe: null },
    { id: 'annuaire', nom: 'annuaire', proprietaire: 'p', compte: 'organisation' as const, reprise: null, repris: false, description: null, prive: true, url: 'https://github.com/p/annuaire', misAJourLe: null },
  ],
  '/projets/poc-portail/stories': [story],
  '/projets/annuaire/stories': [],
  '/projets/poc-portail/apercu': { etat: 'demarrage', url: null, journal: null },
  '/projets/poc-portail/versions': { actuelle: null, proposee: null },
  '/projets/annuaire/versions': { actuelle: null, proposee: null },
}

/** Choisit un projet dans la barre latérale. */
const choisir = async (wrapper: ReturnType<typeof mount>, projet: string) => {
  await wrapper.findAll('nav[aria-label="Projets et demandes"] ul[aria-label="Vos projets"] button').find((bouton) => bouton.text().includes(projet))!.trigger('click')
  await flushPromises()
}
const bouton = (wrapper: ReturnType<typeof mount>, texte: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(texte) || b.attributes('title') === texte || b.attributes('aria-label') === texte)

/** Monte l'atelier ; aucun projet n'est ouvert à l'arrivée : on choisit `projet` dans la barre latérale. */
const monter = async (projet: string | null = 'poc-portail') => {
  const wrapper = mount(AtelierView, { global: { plugins: [Ui] }, attachTo: document.body })
  await flushPromises()
  if (projet) await choisir(wrapper, projet)
  return wrapper
}

describe('Écran de l’atelier', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    lire.mockReset()
    envoyer.mockReset()
    lire.mockImplementation(async (chemin: string) => reponses[chemin])
    envoyer.mockResolvedValue({ etat: 'demarrage', url: null, journal: null })
  })

  it('à l’arrivée, aucun projet n’est ouvert : le PO le choisit dans la barre latérale', async () => {
    const wrapper = await monter(null)
    expect(wrapper.text()).toContain('Choisissez un projet dans la barre de gauche.')
    expect(wrapper.findAll('ul[aria-label="Vos projets"] button').map((b) => b.text())).toEqual(expect.arrayContaining(['poc-portail', 'annuaire']))
    expect(envoyer).not.toHaveBeenCalledWith('/projets/poc-portail/apercu', {})
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('un projet ouvert : ses demandes dans la barre, l’accueil « Que fait-on ? » au centre, l’aperçu qui démarre', async () => {
    const wrapper = await monter()
    expect(wrapper.find('ul[aria-label="Vos projets"] button[aria-current="true"]').text()).toBe('poc-portail')
    expect(wrapper.find('nav').text()).toContain('Page d’accueil')
    expect(wrapper.find('#titre-accueil').text()).toBe('Que fait-on sur poc-portail ?')
    expect(wrapper.text()).toContain('Story conseillée : #1 Page d’accueil')
    expect(wrapper.text()).toContain('Préparation de l’aperçu de « poc-portail »')
    expect(envoyer).toHaveBeenCalledWith('/projets/poc-portail/apercu', {})
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('l’accueil ouvre une conversation avec ADA (Entrée envoie)', async () => {
    const conversation = { ...story, numero: 9, type: 'conversation', titre: 'Conversation : mets le titre en bleu', statut: 'en-cours' }
    envoyer.mockImplementation(async (chemin: string) => (chemin.endsWith('/conversation') ? conversation : { etat: 'demarrage', url: null, journal: null }))
    const wrapper = await monter()
    await wrapper.find('#message-accueil').setValue('Mets le titre en bleu')
    await wrapper.find('#message-accueil').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/poc-portail/stories/conversation', { texte: 'Mets le titre en bleu' })
    wrapper.unmount()
  })

  it('« Masquer le projet » ferme le projet ouvert, qui reste dans la barre', async () => {
    const wrapper = await monter()
    await bouton(wrapper, 'Masquer le projet')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Choisissez un projet dans la barre de gauche.')
    expect(wrapper.findAll('ul[aria-label="Vos projets"] button').map((b) => b.text())).toContain('poc-portail')
    expect(bouton(wrapper, 'Masquer le projet')).toBeUndefined()
    wrapper.unmount()
  })

  it('un projet créé par ADA peut être retiré d’ADA, mais n’a pas de reprise à annuler', async () => {
    const wrapper = await monter()
    expect(bouton(wrapper, 'Retirer d’ADA')).toBeDefined()
    expect(bouton(wrapper, 'Annuler la reprise')).toBeUndefined()
    wrapper.unmount()
  })

  it('stories et problèmes s’écrivent sur GitHub, liens rangés en bas de la barre', async () => {
    const wrapper = await monter()
    expect(wrapper.find('a[href="https://github.com/p/poc-portail/issues/new?template=user-story.yml"]').exists()).toBe(true)
    expect(wrapper.find('a[href="https://github.com/p/poc-portail/issues/new?template=bug.yml"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('la demande guidée (avec plan) reste proposée en suggestion', async () => {
    const wrapper = await monter()
    await bouton(wrapper, 'Demande guidée, avec un plan à valider')!.trigger('click')
    expect(wrapper.find('h2.titre-4').text()).toBe('Prompter (mode libre)')
    wrapper.unmount()
  })

  it('une demande en cours : l’accueil propose d’y aller, pas d’en ouvrir une autre', async () => {
    lire.mockImplementation(async (chemin: string) =>
      chemin === '/projets/poc-portail/stories' ? [{ ...story, statut: 'en-cours' }] : reponses[chemin],
    )
    const wrapper = await monter()
    expect(wrapper.find('#message-accueil').exists()).toBe(false)
    expect(wrapper.text()).toContain('#1 « Page d’accueil » est en cours')
    expect(bouton(wrapper, 'Y aller')).toBeDefined()
    wrapper.unmount()
  })

  it('« Nouvelle conversation » ramène à l’accueil, zone de message prête', async () => {
    const wrapper = await monter()
    await wrapper.findAll('ul.liste-stories button').find((b) => b.text().includes('Page d’accueil'))?.trigger('click')
    await flushPromises()
    await bouton(wrapper, 'Nouvelle conversation')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('#titre-accueil').exists()).toBe(true)
    expect(document.activeElement?.id).toBe('message-accueil')
    wrapper.unmount()
  })

  it('l’aperçu se regarde en grand, puis on revient à la conversation (bouton ou Échap)', async () => {
    const wrapper = await monter()
    const panneau = () => wrapper.find('#panneau-apercu').element as HTMLElement
    const centre = () => wrapper.find('section[aria-label="Demande en cours"]').element as HTMLElement
    expect(panneau().style.display).toBe('none')
    expect(envoyer).toHaveBeenCalledWith('/projets/poc-portail/apercu', {})
    await bouton(wrapper, 'Voir l’aperçu en grand')!.trigger('click')
    await flushPromises()
    expect(panneau().style.display).toBe('')
    expect(centre().style.display).toBe('none')
    expect(document.activeElement?.id).toBe('titre-apercu')
    await bouton(wrapper, 'Revenir à la conversation')!.trigger('click')
    await flushPromises()
    expect(panneau().style.display).toBe('none')
    expect(centre().style.display).toBe('')
    expect(document.activeElement?.id).toBe('voir-apercu')
    await bouton(wrapper, 'Voir l’aperçu en grand')!.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(panneau().style.display).toBe('none')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('l’aperçu prêt s’ouvre aussi dans un onglet, depuis la conversation', async () => {
    lire.mockImplementation(async (chemin: string) => reponses[chemin])
    envoyer.mockResolvedValue({ etat: 'pret', url: 'http://localhost:5301', journal: null })
    const wrapper = await monter()
    await flushPromises()
    const lien = wrapper.find('.atelier__haut a[href="http://localhost:5301"]')
    expect(lien.exists()).toBe(true)
    expect(lien.attributes('target')).toBe('_blank')
    wrapper.unmount()
  })

  it('relit les demandes quand on clique sur « Actualiser »', async () => {
    const wrapper = await monter()
    lire.mockClear()
    await bouton(wrapper, 'Actualiser')!.trigger('click')
    await flushPromises()
    expect(lire).toHaveBeenCalledWith('/projets/poc-portail/stories')
    wrapper.unmount()
  })

  it('recharge les demandes quand on change de projet', async () => {
    const wrapper = await monter()
    await choisir(wrapper, 'annuaire')
    expect(lire).toHaveBeenCalledWith('/projets/annuaire/stories')
    expect(wrapper.text()).toContain('Aucune demande pour l’instant')
    wrapper.unmount()
  })

  it('propose de créer un projet quand il n’y en a aucun', async () => {
    lire.mockImplementation(async (chemin: string) =>
      chemin === '/projets'
        ? []
        : chemin === '/projets/modeles'
          ? {
              familles: [{ id: 'service', libelle: 'Un service' }],
              types: [{ id: 'service', famille: 'service', libelle: 'Service en ligne', description: 'Une application' }],
              modeles: [{ id: 'vue-nest', type: 'service', libelle: 'Vue 3 + NestJS', pourQuoi: 'Métier', disponible: true, deployable: false }],
            }
          : undefined,
    )
    const wrapper = await monter(null)
    await wrapper.findAll('button').find((b) => b.text().includes('Nouveau projet'))!.trigger('click')
    await flushPromises()
    expect(wrapper.find('h2.titre-4').text()).toBe('Nouveau projet')
    expect(wrapper.text()).toContain('Votre idée')
    // Rien à afficher à droite pendant la création : le formulaire est centré.
    expect(wrapper.find('.justify-center form').exists()).toBe(true)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité automatique', async () => {
    const wrapper = await monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
