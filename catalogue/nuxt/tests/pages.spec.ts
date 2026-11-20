import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import App from '~/app.vue'
import Accueil from '~/pages/index.vue'
import Accessibilite from '~/pages/accessibilite.vue'
import { violationsAccessibilite } from './accessibilite'

describe('Pages du site', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('accueil : un seul titre principal, accessible', async () => {
    const page = await mountSuspended(Accueil, { attachTo: document.body })
    expect(page.findAll('h1')).toHaveLength(1)
    expect(await violationsAccessibilite(document.body)).toEqual([])
  })

  it('déclaration d’accessibilité : état de conformité affiché', async () => {
    const page = await mountSuspended(Accessibilite, { attachTo: document.body })
    expect(page.text()).toContain('État de conformité')
    expect(page.text()).toContain('non conforme')
    expect(await violationsAccessibilite(document.body)).toEqual([])
  })

  it('gabarit : lien d’évitement, en-tête, contenu principal, pied de page avec la mention d’accessibilité', async () => {
    const site = await mountSuspended(App, { attachTo: document.body })
    expect(site.find('a[href="#contenu"]').exists()).toBe(true)
    expect(site.find('main#contenu').exists()).toBe(true)
    expect(site.text()).toContain('Accessibilité : non conforme')
  })
})
