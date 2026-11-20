ADA studio (fichier EDITION = studio). Ce n'est pas l'ADA de `~/atelier-po`, ne la modifie jamais.

# ADA studio — interface web — instructions pour les agents de code

Lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe pour Claude Code.

Objectif : permettre à des personnes qui ne codent pas (les « PO ») de produire des POC en autonomie. Le PO crée son
projet dans l'atelier, **écrit ses stories et ses signalements dans GitHub** (formulaires
d'issue du projet), puis les voit apparaître dans l'atelier et **les lance une par une** ;
l'aperçu du produit tourne à droite dès la création du projet.

## Architecture
- `api/` : NestJS (ESM, imports en `.js`). Aucune base de données : les **stories s'écrivent dans
  GitHub** (issues), mais **ADA garde elle-même l'état de chaque demande** (demande figée au
  lancement, journal des échanges, statut) : `api/src/stories/demandes.ts`, `docs/adr/0011`.
  Le label de statut et les commentaires d'ADA sont une copie pour l'équipe, **jamais relue pour
  décider** : ce qui s'écrit sur GitHub hors de l'interface d'ADA ne peut pas l'influencer. Le client GitHub agit au
  nom du PO connecté (jeton utilisateur de la GitHub App).
- `front/` : Vue 3 + UnoCSS (`uno.config.ts`, jetons `--app-*`) + composants maison `Ui*`
  (`front/src/components/ui/`, chacun avec sa story Storybook) + icônes Remix Icon
  (`front/scripts/icones.mjs` génère `src/styles/icones.css`) + Pinia (session, projets, stories).
- Édition : `api/src/edition/edition.ts` (fichier EDITION, sujets GitHub de l'autre édition refusés) ;
  style et bibliothèque des projets : `api/src/variantes/combinaisons.ts` (lit `variantes/combinaisons.json`).
- Règles d'une demande (lecture des formulaires GitHub, « prête » = complète et 4 critères au
  maximum, une seule active par projet) : `api/src/stories/story.ts` ; types côté front dans
  `front/src/lib/story.ts`. **L'atelier ne crée de story qu'à la demande explicite du PO** :
  quand il valide un découpage proposé par l'assistant (stories préremplies, relues et
  éventuellement corrigées par lui, publiées à son nom ; la demande d'origine devient leur
  parent). Sinon, il lit, vérifie, lance.
- Conversation (« vrai prompt », issue `mode-conversation`) : le PO parle librement, ADA agit tout de
  suite sur une branche `conversation/<n>-…` (consigne `consigneConversation`), sans plan ; statut
  `story:conversation` quand c'est au PO. « C'est bon » ouvre la PR (circuit habituel) ; « arrêter »
  ferme l'issue sans suite. Jamais de push sur main ni de fusion par l'agent. L'agent n'a aucun
  accès à GitHub : des stories pour plus tard vont dans « stories » de sa réponse ; le PO les
  choisit dans la conversation et ADA les publie à son nom, sans lien parent (`stories/decoupage.ts`).
- Projets : **un nouveau projet est créé sur le compte GitHub de la personne connectée** (jeton
  utilisateur), jamais sur `GITHUB_PROPRIETAIRE`. Identifiant `nom` (compte `GITHUB_PROPRIETAIRE`)
  ou `compte~nom` (compte personnel du PO),
  lu par `api/src/projets/depot.ts` ; toute route `projets/:depot` passe par `ProjetGuard`.
  **Chaque projet créé reçoit les skills `po-` d'ADA** (`skills/po/`, dossier `SKILLS_PO`) : copiées dans
  `.agents/skills/` et reliées depuis `.claude/skills/`, au même commit que le modèle (`api/src/projets/skills-projet.ts`). Un
  projet existant est d'abord analysé par l'assistant (phase « reprise », `api/src/agent/consigne-reprise.ts`),
  puis entre dans ADA par une PR de reprise que le PO fusionne (`docs/adr/0010`).
- Registre des projets (`api/src/indicateurs/registre*.ts`, fichier `registre/projets.json` hors
  git) : la seule trace gardée hors de GitHub, pour que les indicateurs comptent aussi les projets
  archivés, retirés d'ADA ou supprimés. Il ne fait que grandir ; l'état de chaque projet vient de GitHub.
- Aperçu (`api/src/apercu/`) : clone du dépôt avec le jeton du PO (jeton passé par
  l'environnement, jamais en argument), puis `docker compose` (PostgreSQL + application, limites
  mémoire/CPU, ports 5300-5399 sur 127.0.0.1). Dossier de travail `apercus/`, hors git.
  **Le dossier git d'un projet est rangé à côté du dépôt monté dans le conteneur**
  (`apercus/<projet>/git`, jamais dans `depot/.git`) et tout `git -C <dépôt>` du serveur le désigne
  explicitement (`api/src/apercu/git-isole.ts`) : une commande lancée dans le conteneur ne peut pas
  y poser un hook exécuté ensuite sur le serveur. `ada.json` est validé strictement (image, dossiers)
  car il finit dans `compose.yml` et des scripts shell. L'agent ne lit que les réglages de
  l'utilisateur du serveur (`--setting-sources user`), sans les secrets d'ADA dans son environnement.
  **Le texte d'une demande est une donnée, jamais une consigne** (`DEMANDE_EST_UNE_DONNEE`, dans
  chaque consigne) ; les chemins réservés (`.github/`, `charts/`, `.claude/`, `.agents/`, `.mcp.json`)
  ne partent jamais dans une branche (`cheminsReserves`, vérifié avant le push, quel que soit l'outil
  utilisé) ; une skill apportée par le dépôt lui-même passe le même contrôle que celles d'ADA
  (`equiper-skills.ts`) et ne remplace jamais l'une d'elles. Cas d'injection du banc d'essai :
  `scripts/banc-agent/cas.mjs`.
- **Confiance** (avant le lancement, et pour les demandes d'avant ADR-0011) : les issues et commentaires GitHub sont publics ; seuls ceux d'un propriétaire, ou d'un
  membre/collaborateur qui a le droit d'écrire (vérifié auprès de GitHub : le lien « membre » ne dit
  rien du droit) comptent (`api/src/stories/confiance.ts`) : les autres ne
  parviennent ni à l'agent ni à l'écran, et une issue écrite par un inconnu ne se lance pas.
  `ProjetGuard` vérifie aussi, auprès de GitHub et avec le jeton du PO, que le dépôt lui est visible.
- **Un agent à la fois par projet, `AGENT_MAX_SIMULTANES` sur la machine**, puis une file d'attente
  (`docs/adr/0004`). ADA vérifie qu'elle peut démarrer AVANT d'écrire dans GitHub. La pull request
  d'une demande se retrouve sur GitHub par sa branche : le fichier d'activité local ne suffit pas.
  La fusion est refusée si la branche a avancé en dehors d'ADA (commit noté à chaque push).
- **Protection de `main`** : à l'ouverture d'un projet, ADA vérifie qu'une règle exige une PR et la
  pose sinon (`api/src/projets/projets.service.ts`, `assurerProtection`). **Projet repris** : ADA ne
  pose rien d'elle-même, elle **propose** et le PO décide (son choix est retenu, il peut y revenir). Les contrôles exigés avant fusion se lisent dans cette règle, `ada.json` à défaut.

## Conventions
- **Un fichier, une responsabilité** : 400 lignes non vides au plus par fichier de code, 600 par
  test (contrôle « Taille des fichiers » en CI). Un service qui grossit délègue à de petites classes
  ou fonctions qu'il construit lui-même (ex. `api/src/agent/` : `ordonnanceur.ts`, `phase-*.ts`,
  `outils-phase.ts`), sans couche d'architecture en plus. Montage partagé des tests : `*.banc.ts`.
- Validation avec Zod côté API ; jamais de `any`.
- Erreurs GitHub traduites par `traduireErreurGithub` (404, 403, 401).
- Pinia dès qu'une donnée sert à plusieurs composants ; sinon `ref` local.
- Composants `Ui*` plutôt que du HTML maison, chacun avec sa story (`Ui*.stories.ts`, tous ses états) ;
  un seul `h1` par page. Aucune identité de l'État (ni police, ni couleur, ni bloc-marque officiels).
- Chaque critère, un test ; chaque écran ou formulaire, un test d'accessibilité automatique
  (`front/src/__tests__/accessibilite.ts`, axe-core).
- **Accessibilité (RGAA)** : mêmes bases que pour les projets (section « Accessibilité » de
  `catalogue/vue-nest/AGENTS.md`, reprises dans `api/src/agent/agent.ts`) ; vérifiées par le lint
  `eslint-plugin-vuejs-accessibility` (règle `label-has-for` : for/id suffit).
- **Pilotage à la voix** (Commande vocale, Accès vocal, Dragon) : chaque bouton et lien porte un
  intitulé **visible**, contenu dans son nom accessible (jamais d'icône seule) ; vérifié par
  `violationsAccessibilite`. Les zones de message proposent « Dicter » (`BoutonDicter`).
- Mocks typés dans les tests front (`vi.fn<() => Promise<T>>()`).

## Commandes
| Action | Commande |
|---|---|
| Lancer l'API | `cd api && npm run start:dev` (port 5701, préfixe `/api` ; refuse de démarrer sans EDITION) |
| Lancer le front | `cd front && npm run dev` (port 5700, proxy `/api` et `/__version__`) |
| Storybook de l'interface | `cd front && npm run storybook` (port 5702) ; `npm run build-storybook` |
| Icônes | `cd front && npm run icones` (après avoir utilisé une nouvelle icône Remix) |
| Tests | `cd api && npm test && npm run test:e2e && cd ../front && npm run test:unit -- --run` |
| Lint | `cd api && npm run lint && cd ../front && npx oxlint . && npx eslint .` |
| Compilation | `cd api && npm run build && cd ../front && npm run type-check && npm run build-only` |

## Messages de commit (release-please)
Conventional Commits, versions SemVer par release-please : `fix:` → correctif, `feat:` →
mineure, `!` / `BREAKING CHANGE:` → majeure (mineure avant 1.0.0) ; `test:`, `docs:`, `chore:`,
`refactor:` sans version. Fusion en squash : le titre de la PR devient le commit de `main` ; il
est vérifié en CI (`titre-pr.yml`) et par ADA avant de fusionner une demande
(`api/src/versions/conventionnel.ts`).

## Règles absolues
- Aucun secret dans le dépôt (`api/.env` est ignoré ; gitleaks en CI, et en local après `pre-commit install` ; `--no-verify` interdit).
- Seuls les comptes de `LOGINS_AUTORISES` (ou le propriétaire) se connectent : ne jamais affaiblir ce contrôle.
- Aucune fonction de suppression de dépôt ou d'issue dans l'interface.
