import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Ui from '@/components/ui'
import PanneauComposants from '../PanneauComposants.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const reponse = (corps: unknown) => new Response(JSON.stringify(corps), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('Onglet « Composants » : le Storybook du projet', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('lance Storybook dans l’aperçu, puis l’affiche dès qu’il répond', async () => {
    const appels: string[] = []
    let etat = 'arrete'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (adresse, options) => {
        appels.push(`${options?.method ?? 'GET'} ${String(adresse)}`)
        if (options?.method === 'POST') etat = 'demarrage'
        else if (etat === 'demarrage' && appels.length > 2) etat = 'pret'
        return reponse({ etat, url: etat === 'pret' ? 'http://localhost:5770' : null })
      }),
    )
    const wrapper = mount(PanneauComposants, { props: { projet: 'gladys', intervalleMs: 1 }, global: { plugins: [Ui] }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.text()).toContain('Préparation des composants de « gladys »')
    await new Promise((resoudre) => setTimeout(resoudre, 10))
    await flushPromises()
    expect(appels).toContain('POST /api/projets/gladys/apercu/composants')
    expect(wrapper.find('iframe').attributes('src')).toBe('http://localhost:5770')
    expect(wrapper.find('iframe').attributes('title')).toBe('Composants du projet gladys')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('projet sans écrans : le dit simplement', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => reponse({ etat: 'indisponible', url: null })))
    const wrapper = mount(PanneauComposants, { props: { projet: 'script' }, global: { plugins: [Ui] }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.text()).toContain('n’a pas de composants à montrer')
    wrapper.unmount()
  })
})
