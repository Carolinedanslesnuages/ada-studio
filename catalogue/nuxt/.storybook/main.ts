import type { StorybookConfig } from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'
import { mergeConfig } from 'vite'

// Storybook du site : chaque composant réutilisable (app/components/) a sa story, à côté de lui.
// Les composants sont montrés hors de Nuxt : ils ne dépendent que de Vue et des jetons du projet.
const config: StorybookConfig = {
  stories: ['../app/components/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: { name: '@storybook/vue3-vite', options: {} },
  core: { disableTelemetry: true },
  viteFinal: (configuration) => mergeConfig(configuration, { plugins: [vue()] }),
}

export default config
