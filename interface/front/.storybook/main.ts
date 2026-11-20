import type { StorybookConfig } from '@storybook/vue3-vite'

// Storybook de l'interface d'ADA studio : chaque composant Ui* a sa story, avec tous ses états.
const config: StorybookConfig = {
  stories: ['../src/components/ui/*.stories.ts'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', 'storybook-addon-pseudo-states'],
  framework: { name: '@storybook/vue3-vite', options: {} },
  core: { disableTelemetry: true },
}

export default config
