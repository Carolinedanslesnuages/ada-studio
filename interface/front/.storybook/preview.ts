import { setup, type Preview } from '@storybook/vue3-vite'
import 'virtual:uno.css'
import '../src/styles/icones.css'
import '../src/styles.css'
import Ui from '../src/components/ui'

setup((app) => {
  app.use(Ui)
})

/** Les stories ressemblent à l'interface ; une violation d'accessibilité fait échouer. */
const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
}

export default preview
