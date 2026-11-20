import type { Preview } from '@storybook/vue3-vite'
import '../site/.vitepress/theme/styles/jetons.css'

/** Les stories ressemblent au site ; une violation d'accessibilité fait échouer. */
const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
}

export default preview
