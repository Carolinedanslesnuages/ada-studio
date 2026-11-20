import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'site/.vitepress/cache/**', 'storybook-static/**']),

  ...pluginVue.configs['flat/essential'],

  // Accessibilité vérifiée à l'écriture (images, étiquettes, clavier, ARIA…) : la CI échoue sinon.
  ...pluginVueA11y.configs['flat/recommended'],
  {
    name: 'app/accessibilite-etiquettes',
    rules: {
      // Étiquette reliée au champ par for/id (conforme RGAA) : l'imbrication n'est pas exigée.
      'vuejs-accessibility/label-has-for': ['error', { required: { some: ['nesting', 'id'] } }],
    },
  },
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['site/.vitepress/**/__tests__/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  {
    name: 'app/noms-explicites',
    rules: {
      // Des noms qui ont du sens : pas de « el », « x », « s »… (sauf noms imposés par les bibliothèques).
      'id-length': [
        'error',
        { min: 3, properties: 'never', exceptions: ['vi', 'id', 'ok', 'fs', 'db', 'ui', 'to', '_'] },
      ],
    },
  },

  skipFormatting,
)
