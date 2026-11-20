import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Ui from '@/components/ui'
import AnnulerReprise from '../AnnulerReprise.vue'
import { api } from '@/services/api'
import type { Projet } from '@/stores/projets'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

vi.mock('@/services/api', async (original) => ({
  ...(await original<typeof import('@/services/api')>()),
  api: {
    lire: vi.fn<(chemin: string) => Promise<unknown>>(),
    envoyer: vi.fn<(chemin: string, corps: unknown) => Promise<unknown>>(),
  },
}))
const envoyer = vi.mocked(api.envoyer)

const projet = (extra: Partial<Projet>): Projet => ({
  id: 'un-po~mon-poc',
  nom: 'mon-poc',
  proprietaire: 'un-po',
  compte: 'personnel',
  reprise: null,
  repris: true,
  description: null,
  prive: true,
  url: 'https://github.com/un-po/mon-poc',
  misAJourLe: null,
  ...extra,
})
const monter = (valeur: Projet) => mount(AnnulerReprise, { props: { projet: valeur }, global: { plugins: [Ui] }, attachTo: document.body })
const bouton = (wrapper: ReturnType<typeof monter>, texte: string) => wrapper.findAll('button').find((element) => element.text().startsWith(texte))

describe('Annuler une reprise / désynchroniser un projet repris', () => {
  beforeEach(() => envoyer.mockReset())
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('reprise en attente : demande confirmation, explique, puis annule', async () => {
    envoyer.mockResolvedValue({ etat: 'annulee' })
    const wrapper = monter(projet({ reprise: { pullRequest: 'https://github.com/un-po/mon-poc/pull/3' } }))
    await bouton(wrapper, 'Annuler la reprise')!.trigger('click')
    expect(wrapper.text()).toContain('Le projet n’a jamais été modifié')
    expect(envoyer).not.toHaveBeenCalled()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await bouton(wrapper, 'Confirmer l’annulation')!.trigger('click')
    await flushPromises()
    expect(envoyer).toHaveBeenCalledWith('/projets/un-po~mon-poc/reprise/annuler', {})
    expect(wrapper.emitted('fait')).toEqual([['annulee']])
    wrapper.unmount()
  })

  it('projet dans ADA (repris ou créé par elle) : « Retirer d’ADA », rien n’est supprimé sur GitHub', async () => {
    envoyer.mockResolvedValue({ etat: 'desynchronisee' })
    const wrapper = monter(projet({}))
    await bouton(wrapper, 'Retirer d’ADA')!.trigger('click')
    expect(wrapper.text()).toContain('rien n’est supprimé sur GitHub')
    await bouton(wrapper, 'Confirmer le retrait')!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('fait')).toEqual([['desynchronisee']])
    wrapper.unmount()
  })

  it('« Garder le projet dans ADA » ne fait rien', async () => {
    const wrapper = monter(projet({}))
    await bouton(wrapper, 'Retirer d’ADA')!.trigger('click')
    await bouton(wrapper, 'Garder le projet dans ADA')!.trigger('click')
    expect(envoyer).not.toHaveBeenCalled()
    expect(bouton(wrapper, 'Retirer d’ADA')).toBeDefined()
    wrapper.unmount()
  })
})
