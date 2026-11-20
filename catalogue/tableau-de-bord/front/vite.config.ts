import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { pluginsStyle } from './vite.style.ts'
import { pluginsComposants } from './vite.composants.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), ...pluginsStyle, ...pluginsComposants, vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/__version__': 'http://localhost:3000',
    },
  },
})
