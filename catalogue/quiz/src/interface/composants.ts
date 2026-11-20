import type { App, Component } from 'vue'
import type { Decorator } from '@storybook/vue3-vite'

/**
 * Bibliothèque de composants : aucune. Les composants sont écrits dans le projet
 * (src/components/ui/), chacun avec sa story. Choisi à la création dans ADA studio
 * (ada.json « composants ») ; ne pas installer d'autre bibliothèque.
 */
export function installerComposants(app: App): App {
  return app
}

/** Composant racine de l'application (une bibliothèque peut l'envelopper dans son fournisseur de thème). */
export function envelopper(racine: Component): Component {
  return racine
}

/** Décorateurs Storybook propres à la bibliothèque (thème, conteneur) : aucun ici. */
export const decorateurs: Decorator[] = []
