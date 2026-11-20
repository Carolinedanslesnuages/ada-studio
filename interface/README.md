# ADA studio — interface web

L'interface de développement no-code d'ADA studio : sans écrire de code, l'utilisateur crée ses
projets, écrit ses stories et signale des problèmes ; l'aperçu du produit s'affiche à côté. Consignes pour les agents de code : [AGENTS.md](AGENTS.md).
Décisions : [docs/adr/](docs/adr/README.md).

## Installer et lancer ADA studio (pas à pas)

Pour quelqu'un qui part de zéro, sur sa propre machine. Comptez une demi-heure. Votre ADA studio sera
**indépendante** de celle des autres : ses projets se créent sur **votre** compte GitHub, et ses
données locales (aperçus, journal des demandes, indicateurs) restent sur votre machine.

### 1. Prérequis

| Outil | Pourquoi | Vérifier |
|---|---|---|
| **Node.js 24** (22.18 au minimum) | API et interface | `node --version` |
| **Docker**, en marche, avec `docker compose` | l'aperçu de chaque projet tourne dans un conteneur | `docker compose version` |
| **git** | clones des projets | `git --version` |
| **Claude Code** (l'agent), connecté à un compte | c'est lui qui analyse et code ; voir l'étape 4 | `claude --version` |
| un **compte GitHub** | ADA s'y connecte et y crée vos projets | |

Facultatif, pour contribuer à ADA : [pre-commit](https://pre-commit.com) (anti-fuite gitleaks avant chaque commit).

### 2. Récupérer ADA studio

```bash
cd ~/ada-studio
cat EDITION               # doit afficher « studio » : sans ce fichier, l'API refuse de démarrer
pre-commit install        # facultatif : bloque un secret avant qu'il soit commité
```

ADA studio coexiste avec l'ADA du travail (`~/atelier-po`) : ports, conteneurs, sujet GitHub,
cookie et GitHub App sont distincts (voir le README racine). Ne lancez jamais ses commandes dans
l'autre dossier.

Tout est dans ce dépôt : les skills, les modèles de projet (`catalogue/`) et l'interface (`interface/`).

### 3. Créer votre GitHub App « ADA studio »

Suivez la section [Mise en place de la GitHub App](#mise-en-place-de-la-github-app-une-fois)
ci-dessous : création, identifiants, **installation sur votre compte** (indispensable). C'est une
App **distincte** de celle d'ADA, nommée « ADA studio ».

### 4. L'agent de code

ADA lance l'agent elle-même, en mode non interactif, avec la commande indiquée dans `AGENT_COMMANDE`.
Elle attend les options et la sortie de **Claude Code**.

- Installez Claude Code (voir sa documentation), puis lancez `claude` une fois dans un terminal pour
  vous connecter (abonnement ou clé d'API). `AGENT_COMMANDE=claude` suffit alors.
- Vous utilisez seulement l'extension VS Code ? Son exécutable change de dossier à chaque mise à
  jour : créez un petit lanceur (par exemple `~/.local/bin/claude-ada`) qui retrouve la dernière
  version dans `~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude`, et
  mettez son chemin **complet** dans `AGENT_COMMANDE` (`/Users/vous/…` : « ~ » n'y est pas remplacé).
- Sans agent (`AGENT_COMMANDE` vide), ADA s'ouvre, mais ne lance aucune demande.

L'agent ne lit que **vos réglages d'utilisateur** de Claude Code, jamais ceux d'un projet, et
ne reçoit aucun secret d'ADA.

### 5. Les skills de l'assistant (recommandé)

Voir [Skills de l'assistant](#skills-de-lassistant) : deux `git clone`, puis les dossiers des skills
voulues dans `AGENT_SKILLS`, en chemins complets (une skill introuvable est ignorée sans erreur).

### 6. Configurer

```bash
cd interface/api
cp .env.example .env
openssl rand -hex 32      # à coller dans SESSION_SECRET
```

Dans `api/.env`, au minimum : `GITHUB_PROPRIETAIRE` (votre compte), `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `AGENT_COMMANDE`. Pour laisser d'autres comptes se
connecter à **votre** ADA : `LOGINS_AUTORISES` (votre App doit aussi être installée sur leur compte).
Ce fichier contient des secrets : il est ignoré par git, ne le partagez jamais.

### 7. Installer et lancer

```bash
# terminal 1 : l'API (port 5701)
cd interface/api && npm ci && npm run start:dev

# terminal 2 : l'interface (port 5700)
# facultatif : Storybook de l'interface (port 5702) : cd interface/front && npm run storybook
cd interface/front && npm ci && npm run dev
```

Ouvrez <http://localhost:5700>, connectez-vous avec GitHub, puis créez un projet.

### 8. Vérifier

- **Une fois connecté,** <http://localhost:5700/api/diagnostic> montre l'installation de l'App, ses
  permissions et les modèles disponibles, sans aucun secret.
- **Premier projet :** ADA crée le dépôt sur votre compte, protège sa branche principale et démarre son
  aperçu (le premier démarrage installe les dépendances : quelques minutes).
- **L'agent, sans rien écrire sur GitHub :** depuis la racine du dépôt,
  `cd interface/api && npm run build && cd ../..`, puis `node scripts/banc-agent/analyse.mjs --a-blanc`
  (voir `scripts/banc-agent/README.md` pour le banc complet, qui consomme des appels à l'agent).

### Mettre à jour

```bash
git pull
(cd interface/api && npm ci) && (cd interface/front && npm ci)   # si les dépendances ont changé
```

En mode développement (`start:dev`, `npm run dev`), l'API et l'interface rechargent seules le
nouveau code. Avant de mettre à jour, vérifiez qu'aucun agent ne travaille (`pgrep -f "claude -p"`).

### Essayer un autre modèle que Claude (non testé)

ADA garde Claude Code comme agent, mais Claude Code peut parler à un autre modèle par une
adresse compatible avec l'API d'Anthropic. C'est le cas, par exemple, de GLM, chez Zhipu (Z.ai).
Un lanceur fixe `ANTHROPIC_BASE_URL` (l'adresse donnée par le fournisseur), `ANTHROPIC_AUTH_TOKEN` (sa
clé, jamais dans le dépôt), puis lance `claude`. Le nom du modèle va dans `AGENT_MODELE`.

- **Qualité à vérifier :** passez le banc d'essai (`BANC_COMMANDE`, `BANC_MODELE`) et comparez avec Claude
  avant tout usage réel. Le point fragile est le respect des consignes et du format de réponse.
- **Données :** le code des projets et les échanges partent chez ce fournisseur. Décidez-en avec
  votre équipe.
- **Empreinte carbone :** l'estimation d'ADA suppose la taille de modèles connus ; pour un autre
  modèle, elle est approximative.

## Mise en place de la GitHub App (une fois)

1. **Créer l'App** : GitHub → Settings → Developer settings → GitHub Apps → New GitHub App,
   nommée **« ADA studio »**.
   - Homepage URL : `http://localhost:5700`
   - Callback URL : `http://localhost:5700/api/auth/github/callback`
   - Expire user authorization tokens : coché
   - Webhook → Active : **décoché**
   - Permissions de dépôt : Contents, Issues, Pull requests, Workflows, Administration,
     Repository creation : *Read and write* ; Actions, Checks, Commit statuses, Metadata : *Read-only*
   - Where can this GitHub App be installed : *Any account* (chaque personne crée ses projets sur
     son propre compte). App déjà créée en *Only on this account* : page de l'App → **Advanced** →
     *Danger zone* → **Make public**. Seuls les comptes de `LOGINS_AUTORISES` se connectent à ADA.
2. **Récupérer les identifiants** (page de l'App, onglet General) : *Client ID*, puis
   *Generate a new client secret* (40 caractères hexadécimaux, affiché une seule fois — pas la
   section *Private keys*). Les mettre dans `api/.env` (modèle : `api/.env.example`).
3. **Installer l'App, pour chaque personne** — étape indispensable, distincte de l'autorisation :
   page publique de l'App → **Install** → **son propre compte** → **All repositories**. ADA crée
   les nouveaux projets sur le compte GitHub de la personne connectée, jamais sur celui qui a
   configuré ADA. Sans installation, l'App est autorisée à agir au nom de la personne mais ne voit
   aucun de ses dépôts : la création de projet échoue (ADA explique quoi faire).

Aucun dépôt modèle à créer sur GitHub : les modèles de projet vivent dans ce dépôt, dans
`catalogue/<modèle>/` (voir `docs/adr/0006`). Un type de projet n'est proposé à l'utilisateur que si son
dossier est livré avec son `ada.json`.

En cas de doute, une fois connecté : `http://localhost:5700/api/diagnostic` montre
l'installation (`all` / `selected`), les permissions accordées et les modèles disponibles,
sans aucun secret.

## Skills de l'assistant

ADA relie dans chaque projet, avant chaque exécution, les skills listées dans `AGENT_SKILLS`
(`.claude/skills/` et `.agents/skills/`, exclus localement de git : rien n'est commité).
Installation recommandée, à l'emplacement prévu par leurs auteurs :

```bash
git clone https://github.com/IA-Generative/agent-skills.git ~/.local/share/agent-skills  # IA-Generative
```

Skills reliées : `bug-investigate` (problèmes
signalés), `repo-perimetre` (avant de livrer), `controle-qualite-code` (relecture). Mise à jour :
`git -C ~/.local/share/<catalogue> pull`. Avec l'isolement actuel (`--setting-sources user`), l'outil
Skill de l'agent ne voit pas ces skills : la consigne lui indique de lire leur `SKILL.md` au bon moment
(`.claude/skills/<nom>/`), et le banc d'essai compte ces lectures. Leur apport n'est pas encore mesuré.

**Cloisonnement** : l'agent ne lit et n'écrit que dans le projet (règles `Read(./**)`,
`Edit(./**)`…), plus la lecture des dossiers des skills. ADA écarte toute skill qui pré-autorise
des outils (`allowed-tools`) ou exécute des commandes au chargement (c'est le cas d'`adr-new`).

## Sécurité et fiabilité

- **Cloisonnement de l'agent** : lecture et écriture limitées au projet, plus la lecture des
  dossiers de skills ; skills qui pré-autorisent des outils écartées ; **jamais de modification
  de `.github/` ni de `charts/`** (CI, versions, déploiement) ; aucun accès à GitHub (ADA publie
  à la place du PO) ; seuls les réglages de l'utilisateur du serveur sont lus, sans les secrets d'ADA.
- **Aperçu isolé** : le dossier git d'un projet est rangé hors du dépôt monté dans le conteneur.
- **Confiance** : seuls les auteurs qui ont le droit d'écrire dans le projet comptent ; une issue
  écrite par un inconnu ne se lance pas.
- **Processus travailleur** : chaque tâche de l'assistant tourne dans un processus détaché qui
  survit aux redémarrages de l'API ; un agent à la fois par projet (verrou qui « bat » toutes les
  30 secondes, `apercus/<projet>/agent/verrou.json`), au plus `AGENT_MAX_SIMULTANES` sur la
  machine, les suivants en file d'attente.
- **Fusion** : seulement contrôles verts, et refusée si la branche a avancé en dehors d'ADA ; une
  demande en retard sur `main` est mise à jour (contrôles relancés) avant fusion.
- **Protection de `main`** : posée par ADA sur un projet qu'elle crée, proposée au PO sur un projet repris.
- **Un fichier, une responsabilité** : contrôle « Taille des fichiers » dans ADA et chaque projet (`docs/adr/0012`).
- **Retirer un projet d'ADA** (bouton dans l'atelier) n'efface rien sur GitHub : seul son topic part.
- **Sessions** chiffrées sur disque ; **jeton GitHub** renouvelé en silence avant expiration.

## Limites connues

- Compte personnel gratuit + dépôt privé : la protection de `main` est refusée par GitHub ;
  l'interface le signale à l'utilisateur.
- PR de version (release-please) : leurs contrôles attendent une approbation manuelle sur GitHub,
  car ouvertes par le robot GitHub. Sans conséquence : ADA ne publie une version que si la PR
  ne touche que les fichiers de version. Décision et montage prévu en organisation : ADR-0005.

## Liens de démonstration (ADA en ligne)

Le bouton « Copier le lien de démonstration » (panneau Aperçu) démarre, à la demande, une seconde
instance du projet sur sa **dernière version validée** (branche `main`), jamais sur le travail en
cours de l'assistant. Elle a ses propres données et un port de la plage 5830-5899, sur
127.0.0.1. Elle est mise à jour après chaque « Valider et fusionner ».

`URL_DEMO` (`api/.env`) donne l'adresse publique partagée, `{projet}` et `{port}` remplacés :

- en local (par défaut) : `http://localhost:{port}` ;
- en ligne : par exemple `https://{projet}.demo.ada.gouv.fr`, avec un proxy (domaine générique
  `*.demo.ada.gouv.fr`, certificat compris) qui renvoie chaque sous-domaine vers le port de sa démo.
  ADA autorise cet hôte dans le serveur de l'application ; les autres restent refusés.

Le lien s'ouvre sans compte : c'est acceptable parce qu'un projet ne contient que des données
fictives (règle d'ADA). Un POC qui doit être protégé ajoute sa propre connexion.

## Pourquoi les échanges sont recopiés dans GitHub

Chaque demande est une issue, et chaque échange avec l'assistant (questions, réponses du PO,
accord sur le plan) y est **recopié** en commentaire, au nom du PO. C'est voulu : la trace de qui
a demandé et validé quoi (du code est écrit par une IA), un contexte complet pour un développeur
qui reprend, et un historique qui appartient au projet plutôt qu'à l'outil (`docs/adr/0009`).

Mais **ADA ne relit pas GitHub pour décider** (`docs/adr/0011`) : elle fige la demande au lancement
et tient son propre journal des échanges, faits dans son interface. Un commentaire, un label ou
une modification écrits directement sur GitHub ne parviennent ni à l'agent ni au statut ; ADA
signale seulement au PO qu'il y en a, pour qu'il les recopie dans ADA s'il le souhaite.
