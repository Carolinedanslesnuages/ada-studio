import type { App } from 'vue'
import UiAccordeon from './UiAccordeon.vue'
import UiAccordeons from './UiAccordeons.vue'
import UiAlerte from './UiAlerte.vue'
import UiBadge from './UiBadge.vue'
import UiBouton from './UiBouton.vue'
import UiChamp from './UiChamp.vue'
import UiChoixMultiple from './UiChoixMultiple.vue'
import UiChoixUnique from './UiChoixUnique.vue'
import UiEtapes from './UiEtapes.vue'
import UiListe from './UiListe.vue'
import UiTableau from './UiTableau.vue'

/** Composants d’interface d’ADA studio, disponibles dans tous les écrans (et les tests). */
export default {
  install(app: App): void {
    for (const [nom, composant] of Object.entries({ UiAccordeon, UiAccordeons, UiAlerte, UiBadge, UiBouton, UiChamp, UiChoixMultiple, UiChoixUnique, UiEtapes, UiListe, UiTableau })) {
      app.component(nom, composant)
    }
  },
}
