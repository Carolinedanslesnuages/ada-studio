import type { StorybookConfig } from '@storybook/vue3-vite'

// Storybook du projet : chaque composant réutilisable a sa story, à côté de lui (Nom.stories.ts).
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: { name: '@storybook/vue3-vite', options: {} },
  core: { disableTelemetry: true },
}

export default config
