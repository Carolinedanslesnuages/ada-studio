import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { pluginsStyle } from './vite.style.ts'
import { pluginsComposants } from './vite.composants.ts'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), ...pluginsStyle, ...pluginsComposants,
    vueDevTools(),
    // Application installable (manifeste) et utilisable hors connexion (service worker qui garde
    // en cache l'application). Mise à jour proposée à l'utilisateur, jamais imposée en pleine saisie.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icone.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '__NOM_PROJET__',
        short_name: '__NOM_PROJET__',
        description: 'Application installable, utilisable hors connexion.',
        lang: 'fr',
        display: 'standalone',
        start_url: '/',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-masquable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Fichiers jusqu'à 5 Mo gardés en cache, pour un affichage correct hors connexion.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
