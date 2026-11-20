import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import Ui from '@/components/ui'
import ConnexionView from '../ConnexionView.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const monter = async (url: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/connexion', component: ConnexionView }],
  })
  await router.push(url)
  return mount(ConnexionView, { global: { plugins: [Ui, router] }, attachTo: document.body })
}

describe('Écran de connexion', () => {
  it('propose la connexion GitHub', async () => {
    const wrapper = await monter('/connexion')
    expect(wrapper.find('a[href="/api/auth/github"]').text()).toBe('Se connecter avec GitHub')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('présente ADA comme un outil pour les non-développeurs', async () => {
    const wrapper = await monter('/connexion')
    expect(wrapper.findAll('h1')).toHaveLength(1)
    // Pas de logo : le nom est écrit en texte, avec le badge de l'édition.
    expect(wrapper.find('h1').text().replace(/\s+/g, ' ')).toBe('ADA studio')
    expect(wrapper.find('h1 img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Un outil pour les non-développeurs')
    wrapper.unmount()
  })

  it('explique le parcours en cinq étapes, dans l’ordre', async () => {
    const wrapper = await monter('/connexion')
    const etapes = wrapper.findAll('ol li h3').map((h) => h.text())
    expect(etapes).toEqual([
      'Créez votre projet',
      'Écrivez vos stories',
      'Validez le plan',
      'Regardez le résultat',
      'Publiez la version',
    ])
    wrapper.unmount()
  })

  it('liste les garanties de qualité', async () => {
    const wrapper = await monter('/connexion')
    expect(wrapper.text()).toContain('Des tests à chaque story')
    expect(wrapper.text()).toContain('L’accessibilité vérifiée')
    wrapper.unmount()
  })

  it('propose aussi la connexion en bas de page', async () => {
    const wrapper = await monter('/connexion')
    expect(wrapper.findAll('a[href="/api/auth/github"]')).toHaveLength(2)
    wrapper.unmount()
  })

  it('affiche un message si la connexion a échoué', async () => {
    const wrapper = await monter('/connexion?erreur=etat')
    expect(wrapper.text()).toContain('La connexion n’a pas abouti')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
  it('explique qu’un compte n’est pas autorisé', async () => {
    const wrapper = await monter('/connexion?erreur=non-autorise')
    expect(wrapper.text()).toContain('n’est pas autorisé à utiliser cet atelier')
    wrapper.unmount()
  })
  it('explique un refus de GitHub sans détail technique', async () => {
    const wrapper = await monter('/connexion?erreur=github')
    expect(wrapper.text()).toContain('GitHub a refusé la connexion de l’atelier')
    wrapper.unmount()
  })
})
