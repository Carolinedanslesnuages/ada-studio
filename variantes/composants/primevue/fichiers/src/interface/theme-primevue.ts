import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

/**
 * Thème Aura de PrimeVue, recalé sur les jetons du projet. Corrige un défaut d'accessibilité
 * connu : la couleur primaire par défaut (vert 500 sous texte blanc) n'atteint pas 4,5:1.
 * Ici, primaire = teinte 700 (même valeur que --app-primaire), texte blanc : 5,5:1.
 */
export const ThemeProjet = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{teal.50}',
      100: '{teal.100}',
      200: '{teal.200}',
      300: '{teal.300}',
      400: '{teal.400}',
      500: '{teal.500}',
      600: '{teal.600}',
      700: '{teal.700}',
      800: '{teal.800}',
      900: '{teal.900}',
      950: '{teal.950}',
    },
    colorScheme: {
      light: {
        primary: { color: '{primary.700}', contrastColor: '#ffffff', hoverColor: '{primary.800}', activeColor: '{primary.900}' },
        formField: { placeholderColor: '{surface.600}', borderColor: '{surface.500}' },
      },
    },
  },
})
