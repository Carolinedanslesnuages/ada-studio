import type { PluginOption } from 'vite'
import vuetify from 'vite-plugin-vuetify'

/** Extensions Vite de la bibliothèque de composants choisie : Vuetify (import automatique des composants). */
export const pluginsComposants: PluginOption[] = [vuetify({ autoImport: true })]

/** Dépendances que les tests doivent transformer eux-mêmes (Vuetify importe ses CSS). */
export const dependancesATransformer: string[] = ['vuetify']

/** Fichiers de préparation des tests : compléments à jsdom dont Vuetify a besoin. */
export const preparationTests: string[] = ['./vitest.vuetify.ts']
