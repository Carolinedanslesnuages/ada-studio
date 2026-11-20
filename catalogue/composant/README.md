# __NOM_PROJET__

__OBJECTIF__

Composant à intégrer créé avec ADA studio (web component Vue, un seul fichier) : à coller dans
n'importe quelle page. Fiche projet : [PROJET.md](PROJET.md) ; consignes pour les agents de code :
[AGENTS.md](AGENTS.md) ; décisions : [docs/adr/](docs/adr/README.md).

## L'intégrer
`npm ci && npm run build-only` produit `dist/composant.js`, à publier puis à charger :

```html
<script type="module" src="https://adresse-du-composant/composant.js"></script>
<composant-__SLUG__ libelle="Rechercher une ville" elements='["Lille","Lyon","Nantes"]'></composant-__SLUG__>
```

- Réglages (attributs) : `titre`, `libelle`, `elements` (JSON ou « ; »).
- Événement : `choix` (`evenement.detail[0]` = l'élément choisi).
- Couleurs : `--composant-accent`, `--composant-texte`, `--composant-fond`, `--composant-bordure`.
