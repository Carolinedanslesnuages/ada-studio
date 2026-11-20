import { defineConfig, presetWind4 } from 'unocss'

/** UnoCSS, preset Wind 4 (classes de Tailwind 4), couleurs reliées aux jetons --app-* du projet. */
export default defineConfig({
  presets: [presetWind4()],
  theme: {
    colors: {
      primaire: 'var(--app-primaire)',
      'primaire-survol': 'var(--app-primaire-survol)',
      'sur-primaire': 'var(--app-sur-primaire)',
      texte: 'var(--app-texte)',
      'texte-doux': 'var(--app-texte-doux)',
      fond: 'var(--app-fond)',
      'fond-doux': 'var(--app-fond-doux)',
      bordure: 'var(--app-bordure)',
      erreur: 'var(--app-erreur)',
      succes: 'var(--app-succes)',
    },
    radius: { app: 'var(--app-rayon)' },
  },
})
