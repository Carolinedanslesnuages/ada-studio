import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { pluginsStyle } from './vite.style.ts'
import { pluginsComposants } from './vite.composants.ts'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), ...pluginsStyle, ...pluginsComposants, vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // MapLibre (moteur de carte) pèse environ 300 ko compressés ; il n'est chargé qu'avec la carte.
  build: { chunkSizeWarningLimit: 1200 },
  // Le pré-empaquetage de Vite casse l'adresse du « worker » de MapLibre en développement.
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
