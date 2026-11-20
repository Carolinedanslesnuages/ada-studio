import type { PluginOption } from 'vite'

/** Extensions Vite de la bibliothèque de composants choisie (aucune bibliothèque : aucune extension). */
export const pluginsComposants: PluginOption[] = []

/** Dépendances que les tests doivent transformer eux-mêmes (bibliothèques livrées avec leur CSS). */
export const dependancesATransformer: string[] = []

/** Fichiers de préparation des tests propres à la bibliothèque (ex. compléments à jsdom). */
export const preparationTests: string[] = []
