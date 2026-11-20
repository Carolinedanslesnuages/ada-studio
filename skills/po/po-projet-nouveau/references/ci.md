# CI — le filet de sécurité qui remplace la relecture

Sans développeur dans la boucle, **c'est la CI qui autorise une fusion**. Chaque pull request
et chaque push sur `main` lancent : anti-fuite, lint, types, tests (dont accessibilité),
compilation. Versions épinglées (vérifiées le 2026-11-16).

## `.github/workflows/ci.yml` — squelette commun

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  secrets:
    name: Anti-fuite (gitleaks)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1
        with:
          fetch-depth: 0
      - name: gitleaks 8.30.1 (binaire vérifié)
        run: |
          curl -sSfL -o gitleaks.tgz https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
          echo "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  gitleaks.tgz" | sha256sum -c -
          tar -xzf gitleaks.tgz gitleaks
          ./gitleaks git --redact --verbose .

  # + les jobs de la stack (section « CI » du fichier de stack)
```

Règles pour les jobs de la stack :
- `npm ci` (jamais `npm install`) ; Node 24 via `actions/setup-node@v7.1.0` avec cache npm.
- **Lint sans `--fix`** en CI (un script `lint` qui corrige masquerait l'erreur).
- Aucun service externe ni secret : les tests tournent sans base de données réelle.

## `.github/workflows/taille-fichiers.yml` — un fichier, une responsabilité

Copié **tel quel** depuis ADA (`.github/workflows/taille-fichiers.yml`, identique dans chaque
modèle) ; contrôle requis « Taille des fichiers (une responsabilité par fichier) ». Sur chaque PR,
un fichier de code ajouté ou modifié ne dépasse pas 400 lignes non vides (600 pour un test) ; un
fichier déjà plus long est toléré tant qu'il ne grossit pas. Découper par responsabilité, jamais
une fonction par fichier.

Valider le fichier avant de commiter (si Docker est disponible) :
`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12`

## Protection de `main` — à dire au PO quand le dépôt est sur GitHub

> Pour que rien n'arrive sur la branche principale sans que les contrôles soient verts :
>
> 1. Dépôt GitHub → **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
> 2. Nom : `main protégée` ; **Enforcement status** : *Active*.
> 3. **Target branches** → *Add target* → *Include default branch*.
> 4. Cochez : **Restrict deletions**, **Block force pushes**, **Require a pull request before
>    merging** (0 approbation requise), **Require status checks to pass** → *Add checks* :
>    ajoutez chaque contrôle de la CI (ils apparaissent après une première exécution).
> 5. **Create**.

Limite : sur un compte personnel **gratuit**, les règles ne s'appliquent pas aux dépôts
**privés** (il faut GitHub Pro, ou une organisation Team). Dans ce cas l'interface PO garde
le bouton « Valider et fusionner » grisé tant que la CI n'est pas verte : protection
applicative seulement, à signaler au PO.
