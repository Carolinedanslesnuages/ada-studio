# __NOM_PROJET__

__OBJECTIF__

Extension de navigateur créée avec ADA studio (Vue 3, Manifest V3 : Chrome, Edge, Firefox). Fiche projet : [PROJET.md](PROJET.md) ; consignes pour les agents de code :
[AGENTS.md](AGENTS.md) ; décisions : [docs/adr/](docs/adr/README.md).

## Essayer l'extension
1. `npm ci && npm run build-only` : l'extension est construite dans `dist/`.
2. **Chrome ou Edge** : ouvrir `chrome://extensions` (ou `edge://extensions`), activer le
   « Mode développeur », cliquer sur « Charger l'extension non empaquetée » et choisir `dist/`.
3. **Firefox** : ouvrir `about:debugging#/runtime/this-firefox`, « Charger un module
   complémentaire temporaire » et choisir `dist/manifest.json`.
