import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import UnoCSS from 'unocss/vite'

// https://vite.dev/config/
// Ports d'ADA studio (5700 interface, 5701 API) : distincts de ceux de l'ADA du travail.
export default defineConfig({
  plugins: [vue(), UnoCSS(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5700,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5701',
      '/__version__': 'http://localhost:5701',
    },
  },
})
