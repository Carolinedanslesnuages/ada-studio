import type { StorybookConfig } from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'
import { mergeConfig } from 'vite'

// Storybook du site : chaque composant du thème (site/.vitepress/theme/components/) a sa story.
const config: StorybookConfig = {
  stories: ['../site/.vitepress/theme/components/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: { name: '@storybook/vue3-vite', options: {} },
  core: { disableTelemetry: true },
  viteFinal: (configuration) => mergeConfig(configuration, { plugins: [vue()] }),
}

export default config
