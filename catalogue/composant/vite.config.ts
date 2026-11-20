import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Développement : la page de démonstration (index.html). Construction : un seul fichier,
// dist/composant.js, à charger dans n'importe quelle page (Vue y est inclus).
export default defineConfig({
  plugins: [vue({ features: { customElement: true } })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/composant.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'composant.js',
    },
  },
})
