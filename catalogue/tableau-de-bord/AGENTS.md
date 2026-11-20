# __NOM_PROJET__ — instructions pour les agents de code

Lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe pour Claude Code.

Objectif : __OBJECTIF__

## Conventions
- **Noms explicites** : chaque variable, fonction, paramètre ou classe dit ce qu'il contient
  ou fait, en toutes lettres (`salleLibre`, `reservationsDuJour`, `violation`), jamais `el`,
  `x`, `s`, `tmp`, `data2`. Seuls les noms imposés par les bibliothèques restent tels quels
  (`vi`, `expect`, `app`…). Contrôlé par le lint (`id-length`, 3 caractères minimum) : la CI échoue sinon.
- API (`api/`) : NestJS en modules ESM (imports avec suffixe `.js`). Un module par domaine métier.
- Validation des entrées sur des DTO avec `class-validator` (ou un schéma Zod via `StandardSchemaValidationPipe`). Jamais de `any`.
- Accès aux données uniquement via `PrismaService` (module global, `src/prisma/`).
  Prisma 7 : client généré dans `src/generated/prisma` (ne pas modifier, ne pas commiter).
- **Toute modification de `api/prisma/schema.prisma` crée une migration
  (`npx prisma migrate dev --name <nom>`) et doit être signalée pour relecture.**
- Front (`front/`) : un dossier `src/views/` par écran, appels API dans `src/services/`,
  `<script setup lang="ts">`.
- **Pinia** (installé et activé dans `src/main.ts`) : créer un store `src/stores/<domaine>.ts`
  (syntaxe « setup store ») dès qu'une donnée sert à plusieurs écrans ou composants, doit
  survivre à un changement de page, ou est filtrée / modifiée à plusieurs endroits (ex. : la
  liste des prêts, l'utilisateur courant, un panier). Le store appelle les services ; les écrans
  lisent le store. Une donnée propre à un seul écran reste un `ref` local, sans store. Chaque
  store a ses tests (`src/stores/__tests__/`).
- Interface : voir la section « Interface » ci-dessous. Un seul `h1` par page.
- Tout critère d'acceptation se traduit par au moins un test (Vitest côté API et côté front).

## Le tableau de bord
- **Les indicateurs sont calculés côté serveur** (`api/src/indicateurs/indicateurs.ts`, fonctions
  pures testées) à partir des mesures en base (`Mesure` : indicateur, période, valeur). Ajouter un
  indicateur = l'ajouter à `INDICATEURS`, et ses mesures en base. Le front affiche, il ne calcule pas.
- **Graphiques** : dessinés en SVG dans le projet, sans bibliothèque (`src/components/GraphiqueAccessible.vue` :
  réutiliser ce composant). Chaque courbe a sa couleur ET son motif de trait, et **chaque graphique a
  toujours son alternative** (RGAA 1.6) : un résumé en texte et le tableau de ses données.
- Une évolution s'écrit en toutes lettres (« +12 % par rapport au mois précédent »), jamais par
  la couleur ou une flèche seule (`src/lib/format.ts`).
- Données de l'aperçu : `api/prisma/donnees-fictives.sql` (fictives, rejouées seulement si la
  table est vide). Jamais de données réelles dans le dépôt.


<!-- ada:interface:debut -->
## Interface

- Style : **CSS maison** (https://developer.mozilla.org/fr/docs/Web/CSS). Bibliothèque de composants : **Aucune bibliothèque** (https://vuejs.org/guide/essentials/component-basics.html).
- Utilise d'abord les composants du projet (src/components/ui/) ; n'installe aucune autre bibliothèque de composants ni de style.
- CSS maison : styles de chaque composant dans son bloc <style scoped>, avec les jetons --app-* ; aucun outil de style à ajouter.
- Aucune bibliothèque : les composants réutilisables sont écrits dans src/components/ui/ (voir BoutonAction, ChampSaisie, FenetreDialogue, TableauDonnees) ; réutilise-les avant d'en créer un.
- Couleurs, police et rayons : jetons `--app-*` (src/styles/jetons.css). Nouvelle couleur : contraste d'au moins 4,5:1 sur son fond.
- Ne jamais imiter l'apparence d'un site officiel de l'État (Marianne, bleu France, bloc-marque, nom de domaine gouv.fr).
- **Tout nouveau composant réutilisable arrive avec sa story** (`Nom.stories.ts` à côté de lui) qui montre ses états :
  normal, focus, désactivé, erreur, vide, chargement. Les stories sont aussi des tests (rendu et accessibilité) :
  une story manquante bloque la livraison comme un test manquant. `npm run storybook` pour les voir.
<!-- ada:interface:fin -->

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

## Commandes
| Action | Commande |
|---|---|
| Base de données | `docker compose up -d` |
| Lancer l'API | `cd api && npm run start:dev` (préfixe `/api`, port 3000) |
| Lancer le front | `cd front && npm run dev` (proxy `/api` vers le port 3000) |
| Tests | `cd api && npm test && cd ../front && npm run test:unit -- --run` |
| Lint | `cd api && npm run lint && cd ../front && npm run lint` |
| Compilation | `cd api && npm run build && cd ../front && npm run type-check` |

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
