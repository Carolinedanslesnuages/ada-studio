# release-please — dès la création, pour toutes les stacks

release-please lit les messages de commit (Conventional Commits) sur `main`, tient une
pull request « chore(main): release x.y.z » à jour, et crée le tag, la release GitHub et le
`CHANGELOG.md` quand on fusionne cette PR. Une version unique pour tout le projet.

## Fichiers à créer à la racine du projet

`release-please-config.json` :
```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "simple",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true,
      "bump-patch-for-minor-pre-major": false,
      "include-component-in-tag": false
    }
  }
}
```

`.release-please-manifest.json` :
```json
{ ".": "0.1.0" }
```

`version.txt` contenant `0.1.0` (lu et mis à jour par le type `simple`).

`.github/workflows/release-please.yml` : release-please, épinglé à une version **et** à son SHA,
identique à celui des modèles d'ADA studio :
```yaml
name: release-please

# Versions par release-please (PR de version, notes de version, tag et release GitHub), épinglé à
# une version ET à son SHA. La personne publie depuis le panneau « Versions » d'ADA studio, qui
# fusionne la PR de version : pas de fusion automatique ici. La PR de version est ouverte avec le
# jeton du dépôt (GITHUB_TOKEN).
on:
  push:
    branches: [main]

permissions: {}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
    steps:
      - uses: googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

## Messages de commit (obligatoire ensuite)

Format Conventional Commits, en français après le préfixe :
- `feat: <ce que l'utilisateur peut désormais faire>` → version mineure (0.1.0 → 0.2.0)
- `fix: <ce qui est corrigé>` → correctif (0.2.0 → 0.2.1)
- `test:`, `docs:`, `chore:`, `refactor:` → pas de nouvelle version
- `!` avant les deux-points (`feat!: …`) ou `BREAKING CHANGE:` dans le corps : changement
  incompatible (données, adresse ou comportement attendu modifiés) → version majeure
  (1.2.0 → 2.0.0) ; avant 1.0.0, version mineure (`bump-minor-pre-major`).
- Une story liée à une issue GitHub : ajouter `Closes #<numéro>` dans le corps.

Versions [SemVer 2.0.0](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`, tag `vX.Y.Z`,
calculées par release-please — jamais à la main. Fusion en squash : c'est le **titre de la PR**
qui devient le commit de `main` ; le workflow `titre-pr.yml` (contrôle requis « Titre de PR
(Conventional Commits, semver) ») refuse un titre non conforme.

Le commit d'initialisation : `chore: création du projet <nom>`.

## À dire au PO — une seule fois par projet, quand il a un dépôt GitHub

> Pour que les versions de votre projet se créent toutes seules, il faut autoriser GitHub
> à le faire. C'est une manipulation unique :
>
> 1. Ouvrez votre dépôt sur GitHub, puis **Settings** (Paramètres, en haut à droite).
> 2. Dans le menu de gauche : **Actions** → **General**.
> 3. Tout en bas, section **Workflow permissions** :
>    - cochez **Read and write permissions** ;
>    - cochez **Allow GitHub Actions to create and approve pull requests**.
> 4. Cliquez sur **Save**.
>
> Si ces cases sont grisées, c'est un réglage de l'organisation : un administrateur doit
> l'autoriser dans les **Settings de l'organisation** → **Actions** → **General**
> (même section).
>
> Ensuite, à chaque fonctionnalité livrée, une pull request « release » apparaît dans
> l'onglet **Pull requests**. Quand vous voulez publier une version, ouvrez-la et
> fusionnez-la : la version et son journal des changements sont créés.

Vérification : après la première fusion sur `main`, l'onglet **Actions** du dépôt doit
montrer le workflow « release-please » en vert, et l'onglet **Pull requests** une PR
« chore(main): release 0.2.0 ». En cas d'échec « GitHub Actions is not permitted to create
or approve pull requests » : les cases de l'étape 3 ne sont pas cochées.

Limite connue : les tags et releases créés avec le jeton par défaut (`GITHUB_TOKEN`) ne
déclenchent pas d'autres workflows. Si un jour un déploiement doit partir d'une release,
il faudra un jeton dédié : c'est un sujet pour un développeur.
