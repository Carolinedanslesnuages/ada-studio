import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Construction de l'extension dans dist/ : la fenêtre (index.html), le script d'arrière-plan
// (background.js, nom fixe attendu par manifest.json) et le contenu de public/ (manifest, icônes).
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: './',
  build: {
    rollupOptions: {
      input: {
        fenetre: fileURLToPath(new URL('./index.html', import.meta.url)),
        background: fileURLToPath(new URL('./src/background.ts', import.meta.url)),
      },
      output: {
        entryFileNames: (morceau) => (morceau.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
})
