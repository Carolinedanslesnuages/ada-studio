# __NOM_PROJET__ — instructions pour les agents de code

Lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe pour Claude Code.

Objectif : __OBJECTIF__

## Conventions
- **Une page = un fichier Markdown** du dossier `site/` ; son adresse suit son chemin
  (`site/guide/demarrer.md` → `/guide/demarrer`). Toute nouvelle page est ajoutée au menu
  (`themeConfig.sidebar` de `site/.vitepress/config.mts`).
- Écrire en français, phrases courtes, pour le public de la documentation (pas de jargon technique
  sans explication).
- Liens internes relatifs (`./demarrer`) : un lien vers une page absente fait échouer la
  construction.
- Encadrés : conteneurs de VitePress (`::: tip`, `::: warning`, `::: danger`, `::: details`).
- Thème (`site/.vitepress/theme/`) : celui de VitePress aux couleurs du projet (jetons `--app-*`,
  `site/.vitepress/theme/styles/jetons.css`). **Ne pas ajouter de bibliothèque d'interface.**
- Ne jamais imiter l'apparence d'un site officiel de l'État (Marianne, bleu France, bloc-marque, nom de domaine gouv.fr).
- Un composant Vue n'est ajouté que si le Markdown ne suffit pas, dans
  `site/.vitepress/theme/components/`, **avec sa story** (`Nom.stories.ts`) qui montre ses états ; les
  stories sont aussi des tests (rendu et accessibilité axe-core). `npm run storybook` pour les voir.
- **Noms explicites** dans le code : chaque variable dit ce qu'elle contient (lint `id-length`).

## Accessibilité (RGAA) — chaque page
- Un seul titre `#` par page, puis `##`, `###` sans sauter de niveau.
- Chaque image a un texte de remplacement qui dit ce qu'elle montre (`![Schéma du parcours](…)`),
  vide si elle est décorative.
- Un lien dit où il mène, jamais « cliquez ici » ; un tableau a une ligne d'en-têtes.
- Jamais d'information par la couleur seule.

Vérifié automatiquement : `npm run build && npm run verifier:accessibilite` passe axe-core sur
chaque page construite (la CI échoue sinon). Le reste se vérifie à la main et se note dans la
fiche de relecture. Référentiel complet : `ressources/accessibilite/rgaa-4.1.2/README.md`.

## Commandes
| Action | Commande |
|---|---|
| Installer | `npm install` |
| Lancer | `npm run dev` |
| Tests | `npm run test:unit -- --run` |
| Lint / types | `npx oxlint . && npx eslint . && npm run type-check` |
| Construire et vérifier | `npm run build && npm run verifier:accessibilite` |

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
