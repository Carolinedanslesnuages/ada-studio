import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TexteRiche from '../TexteRiche.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

describe('Texte riche (messages d’ADA)', () => {
  it('affiche gras, listes et intertitres sans astérisques, et échappe tout HTML', async () => {
    const wrapper = mount(TexteRiche, {
      props: { texte: '**Accessibilité**\n- un **titre** de page\n- <script>alert(1)</script>' },
      attachTo: document.body,
    })
    expect(wrapper.text()).not.toContain('**')
    expect(wrapper.find('p.texte-gras').text()).toBe('Accessibilité')
    expect(wrapper.findAll('ul li')).toHaveLength(2)
    expect(wrapper.find('li strong').text()).toBe('titre')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('<script>alert(1)</script>')
    expect(wrapper.find('h1, h2, h3, h4, h5, h6').exists()).toBe(false)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})
