import { setProjectAnnotations } from '@storybook/vue3-vite'
import * as a11y from '@storybook/addon-a11y/preview'
import * as projet from './.storybook/preview'

// Le contraste n'est pas mesurable sous jsdom : il est vérifié dans Storybook (navigateur).
setProjectAnnotations([
  a11y,
  projet,
  { parameters: { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } } },
])
