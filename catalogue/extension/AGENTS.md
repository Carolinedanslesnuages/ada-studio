# __NOM_PROJET__ — instructions pour les agents de code

Lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe pour Claude Code.

Objectif : __OBJECTIF__

**C'est une extension de navigateur** (Manifest V3 : Chrome, Edge, Firefox). Une interface sobre et
accessible (`src/style.css`, jetons `--app-*` de `src/styles/jetons.css`). Ne jamais imiter l'apparence
d'un site officiel de l'État (Marianne, bleu France, bloc-marque, nom de domaine gouv.fr).
Composants réutilisables dans `src/components/ui/`, **chacun avec sa story** (`Nom.stories.ts`, aussi
exécutée comme test de rendu et d'accessibilité).

## Conventions
- **Noms explicites** : chaque variable, fonction, paramètre ou classe dit ce qu'il contient
  ou fait, en toutes lettres (`ongletActif`, `reglages`, `violation`), jamais `el`, `x`, `s`,
  `tmp`, `data2`. Seuls les noms imposés par les bibliothèques restent tels quels (`vi`,
  `expect`, `chrome`…). Contrôlé par le lint (`id-length`, 3 caractères minimum) : la CI échoue sinon.
- Structure :
  - `public/manifest.json` : déclaration de l'extension (nom, permissions, fenêtre, arrière-plan) ;
  - `index.html` + `src/App.vue` : la fenêtre qui s'ouvre au clic sur l'icône (Vue 3, `<script setup lang="ts">`) ;
  - `src/background.ts` : arrière-plan (événements du navigateur). Il **n'importe ni Vue ni Pinia**,
    et ne garde rien en mémoire entre deux réveils : tout état passe par `chrome.storage` ;
  - `src/services/stockage.ts` : seul accès au stockage (`chrome.storage.local`, `localStorage` dans l'aperçu).
- **Permissions au plus juste** : aujourd'hui `storage` uniquement. Chaque permission ajoutée
  (`activeTab`, `tabs`, `host_permissions`, `scripting`…) est justifiée dans une ADR et signalée
  pour relecture ; préférer `activeTab` à un accès à tous les sites. Le test `manifest.spec.ts`
  liste les permissions autorisées : le mettre à jour en même temps.
- **Sécurité** : aucun code chargé depuis Internet, pas d'`eval`, pas de `innerHTML` avec du
  contenu de page ; les données lues sur une page sont du texte, jamais du HTML.
- Script de contenu (agir dans une page) : `src/contenu/<nom>.ts`, ajouté à `content_scripts`
  et aux entrées de `vite.config.ts` ; il ne touche que ce que la story demande.
- **Pinia** : un store `src/stores/<domaine>.ts` (syntaxe « setup store ») dès qu'une donnée
  sert à plusieurs écrans ou composants ; sinon un `ref` local. Chaque store a ses tests.
- Tout critère d'acceptation se traduit par au moins un test (Vitest ; `chrome` simulé par
  `simulerChromeStorage` dans `src/__tests__/donnees.ts`), et chaque écran a un test
  d'accessibilité automatique (`violationsAccessibilite`).
- Version : `version.txt` et `public/manifest.json` sont tenus à jour **ensemble** par release-please.

## Accessibilité (RGAA) — les bases, toujours

Le service doit être utilisable par tous (RGAA 4, le référentiel français d'accessibilité). À chaque
écran ou composant, sans exception :

- **Éléments HTML natifs** (`<button>`, `<input>` + `<label for>`, `<fieldset>` + `<legend>`) :
  ils sont accessibles d'office. Couleurs de `src/style.css` uniquement (contrastes vérifiés,
  thème sombre compris) ; focus toujours visible.
- **Page** : `lang="fr"`, un titre de page (`<title>`) qui dit où l'on est, un seul `h1`, des
  titres `h2`, `h3`… sans saut de niveau ; fenêtre étroite : contenu lisible à 320 px de large.
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
| Lancer (fenêtre seule, sans les fonctions du navigateur) | `npm run dev` |
| Construire l'extension | `npm run build-only` → dossier `dist/` |
| Essayer dans Chrome ou Edge | `chrome://extensions` → Mode développeur → « Charger l'extension non empaquetée » → `dist/` |
| Essayer dans Firefox | `about:debugging#/runtime/this-firefox` → « Charger un module temporaire » → `dist/manifest.json` |
| Tests | `npm run test:unit -- --run` |
| Lint | `npx oxlint . && npx eslint .` |
| Types et compilation | `npm run type-check && npm run build-only` |

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
