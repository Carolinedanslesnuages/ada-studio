import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AvatarAda from '../AvatarAda.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

describe('Avatar d’ADA', () => {
  beforeEach(() => {
    const valeurs = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (cle: string) => valeurs.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => valeurs.set(cle, valeur),
      removeItem: (cle: string) => valeurs.delete(cle),
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('un clic l’immobilise, un autre la relance ; le bouton dit ce qu’il fait', async () => {
    const wrapper = mount(AvatarAda, { props: { phase: 'realisation' }, attachTo: document.body })
    const bouton = wrapper.get('button')
    expect(bouton.text()).toContain('ADA réalise…')
    expect(bouton.text()).toContain('arrêter l’animation')
    expect(bouton.classes()).not.toContain('avatar-ada--immobile')
    expect(await violationsAccessibilite(document.body)).toEqual([])

    await bouton.trigger('click')
    expect(bouton.classes()).toContain('avatar-ada--immobile')
    expect(bouton.text()).toContain('relancer l’animation')
    expect(bouton.attributes('title')).toBe('Relancer l’animation')

    await bouton.trigger('click')
    expect(bouton.classes()).not.toContain('avatar-ada--immobile')
    wrapper.unmount()
  })

  it('sans stockage disponible, le bouton marche quand même pour la visite', async () => {
    vi.stubGlobal('localStorage', undefined)
    const wrapper = mount(AvatarAda)
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').classes()).toContain('avatar-ada--immobile')
    wrapper.unmount()
  })

  it('se souvient du choix d’une visite à l’autre', async () => {
    const premiere = mount(AvatarAda)
    await premiere.get('button').trigger('click')
    premiere.unmount()
    const seconde = mount(AvatarAda)
    expect(seconde.get('button').classes()).toContain('avatar-ada--immobile')
    seconde.unmount()
  })
})
