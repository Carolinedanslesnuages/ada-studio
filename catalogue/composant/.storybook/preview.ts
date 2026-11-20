import { setup, type Preview } from '@storybook/vue3-vite'
import { NOM_BALISE } from '../src/composant'

// La balise du composant est un élément personnalisé, pas un composant Vue à résoudre.
setup((app) => {
  app.config.compilerOptions.isCustomElement = (balise) => balise === NOM_BALISE
})

/** Les stories ressemblent au projet ; une violation d'accessibilité fait échouer. */
const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
}

export default preview
