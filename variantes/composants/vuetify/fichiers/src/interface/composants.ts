import type { App, Component } from 'vue'
import type { Decorator } from '@storybook/vue3-vite'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

/**
 * Bibliothèque de composants : Vuetify 3, thème « projet » aux couleurs des jetons --app-*
 * (contrastes ≥ 4,5:1 sur blanc). Pas de mode sombre automatique.
 */
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'projet',
    themes: {
      projet: {
        dark: false,
        // Défaut connu : étiquettes et aides en « moyenne emphase » à 4,24:1. À 0,72 sur le texte du projet : 6:1.
        variables: { 'medium-emphasis-opacity': 0.72, 'high-emphasis-opacity': 1 },
        colors: {
          'on-surface': '#1f2328',
          'on-background': '#1f2328',
          primary: '#0f766e',
          secondary: '#57606a',
          error: '#b42318',
          success: '#1a7f37',
          surface: '#ffffff',
          background: '#ffffff',
        },
      },
    },
  },
})

export function installerComposants(app: App): App {
  return app.use(vuetify)
}

export function envelopper(racine: Component): Component {
  return racine
}

export const decorateurs: Decorator[] = []
