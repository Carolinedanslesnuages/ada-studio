# __NOM_PROJET__ — instructions pour les agents de code

Lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe pour Claude Code.

Objectif : __OBJECTIF__

## Conventions
- Nuxt 4, Vue 3, TypeScript. **Une page = un fichier `app/pages/<adresse>.vue`** (`index.vue` pour
  l'accueil) ; composants réutilisables dans `app/components/`. `<script setup lang="ts">`,
  jamais de `any`.
- **Référencement** : chaque page déclare son titre et sa description (`useSeoMeta({ title,
  description })`), uniques et explicites. Les pages sont générées à l'avance (`npm run
  generate`) : pas de contenu qui n'apparaît qu'après un appel côté navigateur.
- Gabarit commun dans `app/app.vue` (lien d'évitement, en-tête, pied de page) : ne pas
  le dupliquer dans les pages.
- Interface : CSS maison (jetons `--app-*`, `app/assets/css/jetons.css`), composants réutilisables dans
  `app/components/ui/`, **chacun avec sa story** (`Nom.stories.ts`, aussi exécutée comme test de rendu et
  d'accessibilité). Aucune bibliothèque de composants ni de style à ajouter. Un seul `h1` par page.
- Ne jamais imiter l'apparence d'un site officiel de l'État (Marianne, bleu France, bloc-marque, nom de domaine gouv.fr).
- **Déclaration d’accessibilité** (`app/pages/accessibilite.vue`) et mention « Accessibilité :
  … » du pied de page : obligatoires ; à mettre à jour après un audit.
- **Noms explicites** : chaque variable, fonction, paramètre dit ce qu'il contient ou fait
  (`liensEvitement`, `actualitesRecentes`), jamais `el`, `x`, `tmp` (lint `id-length`).
- Tout critère d'acceptation se traduit par au moins un test (`tests/*.spec.ts`,
  `mountSuspended` de `@nuxt/test-utils`), avec un test d'accessibilité automatique par page.

## Accessibilité (RGAA) — les bases, toujours

Le service doit être utilisable par tous (RGAA 4, le référentiel français d'accessibilité). À chaque
écran ou composant, sans exception :

- **Composants existants** d'abord (ceux du projet ou de la bibliothèque choisie) : ne pas recoder un
  bouton, un champ ou une alerte qui existe déjà. Nouvelle couleur : contraste d'au moins 4,5:1.
- **Page** : `lang="fr"`, un titre de page (`<title>`) qui dit où l'on est, un seul `h1`, des
  titres `h2`, `h3`… sans saut de niveau ; liens d'évitement conservés.
- **Images** : alternative qui dit l'information (`alt="…"`), ou `alt=""` si décorative.
- **Formulaires** : chaque champ a une étiquette visible liée ; champs obligatoires signalés ;
  erreurs écrites en clair et reliées au champ (`aria-describedby` vers le message).
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

Vérifié aussi sur le site généré : `npm run generate && npm run verifier:accessibilite` passe
axe-core sur chaque page (la CI échoue sinon).

## Commandes
| Action | Commande |
|---|---|
| Installer | `npm install` |
| Lancer | `npm run dev` |
| Tests | `npm run test:unit -- --run` |
| Lint / types | `npx oxlint . && npx eslint . && npm run type-check` |
| Générer et vérifier | `npm run generate && npm run verifier:accessibilite` |

## Messages de commit (release-please)
Conventional Commits, versions SemVer calculées par release-please (jamais à la main) :
`fix: …` → correctif (0.2.0 → 0.2.1), `feat: …` → fonctionnalité (0.2.0 → 0.3.0),
`feat!: …` ou `BREAKING CHANGE:` → changement incompatible (majeure ; mineure avant 1.0.0),
`test:`, `docs:`, `chore:`, `refactor:` → sans nouvelle version. Fusion en squash : le
**titre de la PR** devient le commit de `main` (contrôle « Titre de PR » en CI). Story issue
d'une issue GitHub : `Closes #<numéro>` dans le corps.

## Règles absolues
- **Un fichier, une responsabilité** : au plus 400 lignes non vides par fichier de code, 600 par fichier de test (contrôle « Taille des fichiers » en CI). Découper par responsabilité, jamais une fonction par fichier ; un fichier déjà trop long ne grossit plus.
- Ne jamais modifier `.github/`.
- Aucune donnée réelle, aucun secret dans le dépôt (gitleaks bloque en CI, et en local une fois `pre-commit install` lancé ; `--no-verify` interdit).
- Une branche par story (`story/…`) ou par bug (`fix/…`) ; jamais de fusion par l'agent.
- Les décisions d'architecture sont tracées dans `docs/adr/`.
