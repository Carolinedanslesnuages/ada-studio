import type { App, Component } from 'vue'
import type { Decorator } from '@storybook/vue3-vite'
import PrimeVue from 'primevue/config'
import 'primeicons/primeicons.css'
import { ThemeProjet } from './theme-primevue'

/**
 * Bibliothèque de composants : PrimeVue 4, mode stylé (thème Aura recalé sur les jetons).
 * Le mode sombre automatique est coupé : l'apparence du projet est claire.
 */
export function installerComposants(app: App): App {
  return app.use(PrimeVue, {
    theme: { preset: ThemeProjet, options: { darkModeSelector: '.app-sombre', cssLayer: false } },
  })
}

export function envelopper(racine: Component): Component {
  return racine
}

export const decorateurs: Decorator[] = []
