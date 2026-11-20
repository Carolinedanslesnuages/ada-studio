import { setup, type Preview } from '@storybook/vue3-vite'
import '../src/interface/style'
import { decorateurs, installerComposants } from '../src/interface/composants'

setup((app) => {
  installerComposants(app)
})

/** Les stories ressemblent à l'application (même style, même bibliothèque) ; une violation d'accessibilité fait échouer. */
const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
  },
  decorators: decorateurs,
  tags: ['autodocs'],
}

export default preview
