import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'
import { dependancesATransformer, preparationTests } from './vite.composants.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      setupFiles: ['./vitest.setup.ts', ...preparationTests],
      server: { deps: { inline: dependancesATransformer } },
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
