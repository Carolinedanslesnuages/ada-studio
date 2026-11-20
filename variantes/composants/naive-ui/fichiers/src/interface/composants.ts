import { defineComponent, h, type App, type Component } from 'vue'
import type { Decorator } from '@storybook/vue3-vite'
import { NConfigProvider } from 'naive-ui'
import { themeProjet } from './theme-naive'

/** Bibliothèque de composants : Naive UI ; son thème (jetons TypeScript) enveloppe l'application. */
export function installerComposants(app: App): App {
  return app
}

export function envelopper(racine: Component): Component {
  return defineComponent({
    name: 'RacineNaive',
    setup: () => () => h(NConfigProvider, { themeOverrides: themeProjet }, () => h(racine)),
  })
}

/** Storybook : chaque story est affichée dans le fournisseur de thème. */
export const decorateurs: Decorator[] = [
  () => ({ components: { NConfigProvider }, setup: () => ({ themeProjet }), template: '<NConfigProvider :theme-overrides="themeProjet"><story /></NConfigProvider>' }),
]
