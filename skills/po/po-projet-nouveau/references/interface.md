# Interface : style, bibliothèque de composants, Storybook

Pour les stacks avec Vue. Aucune identité de l'État : ne jamais imiter l'apparence d'un site
officiel de l'État (Marianne, bleu France, bloc-marque, nom de domaine gouv.fr).

## 1. Les deux choix (menu, réponse par numéro)

**Style** : 1 CSS maison (jetons `--app-*`, aucune dépendance) · 2 Tailwind CSS 4 · 3 UnoCSS (preset Wind 4).

**Bibliothèque de composants** : 1 aucune (composants écrits dans le projet) · 2 Reka UI
(composants accessibles sans style) · 3 shadcn-vue (Reka UI + Tailwind, code copié dans le projet)
· 4 PrimeVue 4 (thème Aura) · 5 Vuetify 3 · 6 Naive UI.

Combinaisons interdites (dire la raison, puis redemander) :
- shadcn-vue sans Tailwind : il est écrit avec Tailwind CSS ;
- PrimeVue avec UnoCSS : pas d'intégration prévue ;
- Vuetify avec Tailwind ou UnoCSS : conflit de styles.

Par défaut : CSS maison, sans bibliothèque. Toutes les options sont gratuites, sous licence MIT et
compatibles Vue 3. La liste de référence (noms, documentation, raisons) est
`variantes/combinaisons.json` dans ADA studio.

## 2. Appliquer le choix

Dans ADA studio : le squelette part du modèle de `catalogue/` (base CSS maison + aucune), puis
`node scripts/variantes.mjs <dossier du projet> <dossier du front> <style> <bibliothèque>`
applique les variantes (fichiers, dépendances, `ada.json`, section « Interface » d'`AGENTS.md`,
ADR-0001). Ensuite `npm install` dans le front.

Hors d'ADA studio : reprendre la même structure à la main —
- `src/interface/style.ts` importe les styles du choix ; `vite.style.ts` exporte ses extensions Vite ;
- `src/interface/composants.ts` installe la bibliothèque (`installerComposants`), enveloppe la
  racine si son thème l'exige (`envelopper`) et fournit les décorateurs Storybook ;
- `src/styles/jetons.css` garde les couleurs du projet (`--app-*`), contrastes ≥ 4,5:1 ;
- `ada.json` : `"edition": "studio"`, `"style"`, `"composants"`.

## 3. Storybook (toujours)

- `@storybook/vue3-vite`, `@storybook/addon-a11y` (réglé pour échouer en cas de violation :
  `parameters.a11y.test = 'error'`), `@storybook/addon-docs`, mêmes versions exactes.
- Scripts : `npm run storybook`, `npm run build-storybook`.
- `src/components/ui/` : bouton, champ, fenêtre de dialogue, tableau, chacun avec sa story qui
  montre ses états (normal, focus, désactivé, erreur, vide, chargement).
- Les stories sont aussi des tests (`src/components/ui/__tests__/stories.spec.ts`) : rendu puis
  axe-core. **Tout nouveau composant réutilisable arrive avec sa story.**
