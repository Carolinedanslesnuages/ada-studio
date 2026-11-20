import type { Preview } from '@storybook/vue3-vite'
import '../src/styles/jetons.css'
import '../src/style.css'

/** Les stories ressemblent au projet ; une violation d'accessibilité fait échouer. */
const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
}

export default preview
