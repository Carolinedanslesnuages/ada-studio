# __NOM_PROJET__ — instructions pour les agents de code

Lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe pour Claude Code.

Objectif : __OBJECTIF__

**C'est un composant à intégrer** : une balise `<composant-__SLUG__>` à coller dans n'importe
quelle page (web component Vue, un seul fichier `dist/composant.js`). Ses styles restent à
l'intérieur (Shadow DOM) : la page hôte garde sa propre apparence. Sa story
(`src/components/RechercheListe.stories.ts`) montre la vraie balise ; tout nouveau composant a la sienne.

## Conventions
- **Noms explicites** : chaque variable, fonction, paramètre ou classe dit ce qu'il contient
  ou fait, en toutes lettres (`elementChoisi`, `resultats`), jamais `el`, `x`, `s`, `tmp`.
  Contrôlé par le lint (`id-length`, 3 caractères minimum) : la CI échoue sinon.
- Structure :
  - `src/components/RechercheListe.ce.vue` : le composant (`.ce.vue` = web component, styles
    isolés dans le Shadow DOM) ; un autre composant interne s'importe normalement ;
  - `src/composant.ts` : déclare la balise ; `src/lib/` : règles (fonctions pures testées) ;
  - `index.html` + `src/main.ts` : page de démonstration (aperçu), avec le mode d'emploi.
- **Le contrat avec les sites hôtes** (à garder stable ; un changement incompatible = `feat!:`) :
  - réglages par **attributs** HTML, en texte (une liste : JSON ou séparée par des « ; ») ;
  - informations renvoyées par **événements** (`emit('choix', …)` → `CustomEvent`, `detail` = arguments) ;
  - couleurs réglables par **variables CSS** `--composant-*` ; la police est héritée de la page.
  Tout nouveau réglage ou événement est documenté dans `index.html` et dans le README.
- **Isolation** : la couleur du texte est fixée dans `.composant`, pas sur `:host` (sinon un
  `color: … !important` de la page hôte s'hérite). Pas de style global, pas de modification de
  la page hôte en dehors de la balise.
- **Tests** sur la vraie balise, comme un site hôte (`document.createElement`, `shadowRoot`,
  `addEventListener`) : voir `src/components/__tests__/RechercheListe.spec.ts`. Un test
  d'accessibilité (axe-core, Shadow DOM compris) par état.
- Pas de dépendance lourde : tout est inclus dans `composant.js` (Vue compris, environ 32 ko compressés).

## Accessibilité (RGAA) — les bases, toujours

Le service doit être utilisable par tous (RGAA 4, le référentiel français d'accessibilité). À chaque
écran ou composant, sans exception :

- **Éléments HTML natifs** (`<button>`, `<input>` + `<label for>`, `<fieldset>` + `<legend>`) :
  ils sont accessibles d'office. Contrastes vérifiés (texte ≥ 4,5:1), y compris avec les couleurs
  réglées par la page hôte ; focus toujours visible.
- **Page** : `lang="fr"`, un titre de page (`<title>`) qui dit où l'on est, un seul `h1`, des
  le composant commence à `h2` (le `h1` est celui de la page hôte) ; lisible à 320 px de large.
- **Images** : alternative qui dit l'information (`alt="…"`), ou `alt=""` si décorative.
- **Formulaires** : chaque champ a une étiquette visible liée ; champs obligatoires signalés ;
  erreurs écrites en clair et reliées au champ (`aria-describedby`).
- **Clavier** : tout ce qui se fait à la souris se fait au clavier, dans un ordre logique, avec
  un focus visible ; jamais de `tabindex` positif ; un élément cliquable est un `<button>` ou un lien.
- **Liens et boutons** : intitulé compréhensible hors contexte (jamais « cliquez ici ») ; un lien
  qui ouvre une nouvelle fenêtre le dit.
- **Information** : jamais par la couleur seule (texte ou icône en plus) ; messages qui
  apparaissent sans rechargement annoncés (`role="status"` ou `aria-live`).
- **Tableaux de données** : un titre et des en-têtes de colonnes.
- **Animations** : respectent `prefers-reduced-motion`.

**Référentiel complet** (DINUM, RGAA 4.1.2, 106 critères et leurs tests) :
`ressources/accessibilite/rgaa-4.1.2/README.md` pour l'index, puis le fichier du thème concerné.

Vérifié automatiquement : le **lint** (`eslint-plugin-vuejs-accessibility`) refuse une image sans
alternative, un champ sans étiquette, un clic sans clavier… et chaque écran a un **test axe-core**
(`violationsAccessibilite`). Ces outils couvrent environ un tiers du RGAA : le reste se vérifie
à la main et se note dans la fiche de relecture (« à vérifier par un humain »).

## Commandes
| Action | Commande |
|---|---|
| Page de démonstration | `npm run dev` |
| Tests | `npm run test:unit -- --run` |
| Lint | `npx oxlint . && npx eslint .` |
| Types et construction | `npm run type-check && npm run build-only` → `dist/composant.js` |

## Messages de commit (release-please)
Conventional Commits, versions SemVer calculées par release-please (jamais à la main) :
`fix: …` → correctif (0.2.0 → 0.2.1), `feat: …` → fonctionnalité (0.2.0 → 0.3.0),
`feat!: …` ou `BREAKING CHANGE:` → changement incompatible (majeure ; mineure avant 1.0.0),
`test:`, `docs:`, `chore:`, `refactor:` → sans nouvelle version. Fusion en squash : le
**titre de la PR** devient le commit de `main` (contrôle « Titre de PR » en CI). Story issue
d'une issue GitHub : `Closes #<numéro>` dans le corps.

## Règles absolues
- **Un fichier, une responsabilité** : au plus 400 lignes non vides par fichier de code, 600 par fichier de test (contrôle « Taille des fichiers » en CI). Découper par responsabilité, jamais une fonction par fichier ; un fichier déjà trop long ne grossit plus.
- Aucune donnée réelle, aucun secret dans le dépôt (gitleaks bloque en CI, et en local une fois `pre-commit install` lancé ; `--no-verify` interdit).
- Une branche par story (`story/…`) ou par bug (`fix/…`) ; jamais de fusion par l'agent.
- Les décisions d'architecture sont tracées dans `docs/adr/`.
