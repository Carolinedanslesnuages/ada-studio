// Site Nuxt, pages générées à l'avance (`nuxt generate`) : chaque page est un fichier
// HTML complet, bien lu par les moteurs de recherche et les lecteurs d'écran.
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      titleTemplate: '%s — __NOM_PROJET__',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
    },
  },
  // Apparence du projet : jetons --app-* et base commune (CSS maison).
  css: ['~/assets/css/jetons.css', '~/assets/css/base.css'],
  modules: ['@nuxt/test-utils/module'],
})
