# __NOM_PROJET__ — instructions pour les agents de code

Lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe pour Claude Code.

Objectif : __OBJECTIF__

## Conventions
- **Noms explicites** : chaque variable, fonction, paramètre ou classe dit ce qu'il contient ou
  fait, en toutes lettres et en français (`demandes_du_jour`, `statut_traite`), jamais `x`, `s`,
  `tmp`, `data2`. Seuls les noms imposés par Django restent tels quels (`Meta`, `list_display`…).
- Python 3.13, Django. Réglages dans `projet/settings.py` (lus dans l'environnement, jamais de
  secret) ; une application métier `gestion/` (`models.py`, `admin.py`, `views.py`).
- **Une donnée = un modèle** (`gestion/models.py`), libellés en français (`verbose_name`).
  **Toute évolution d'un modèle = une migration** (`python manage.py makemigrations`), relue avant
  fusion et signalée pour relecture ; ne jamais modifier une migration déjà fusionnée. La CI
  échoue si un modèle change sans migration.
- **Écrans de gestion** : l'administration de Django (`gestion/admin.py` : colonnes, filtres,
  recherche, champs en lecture seule). Des pages dédiées seulement si l'administration ne suffit
  pas (gabarits `gestion/templates/gestion/`).
- **Droits** : groupes et permissions de Django ; jamais de vérification de droit codée à la main
  quand une permission existe.
- Types partout : mypy en mode strict (django-stubs), la CI échoue sinon. Lint et format : ruff.
- Tout critère d'acceptation se traduit par au moins un test (`gestion/tests/test_<sujet>.py`,
  `django.test.TestCase`), écrans d'administration compris (client de test, `force_login`).
- Dépendances : versions figées dans `requirements.txt` (application) et `requirements-dev.txt`
  (outils) ; une nouvelle dépendance est justifiée dans la fiche.

## Accessibilité (RGAA)
Pages dédiées : `lang="fr"`, un titre de page explicite, un seul `h1`, titres sans saut de niveau,
chaque champ de formulaire avec une étiquette visible liée, erreurs écrites en clair, tout
utilisable au clavier, jamais d'information par la couleur seule, tableaux avec titre et
en-têtes. L'administration de Django suit ces règles : ne pas la dégrader.

## Commandes
| Action | Commande |
|---|---|
| Environnement | `python3.13 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt` |
| Base | `python manage.py migrate` (SQLite en local ; PostgreSQL si `DATABASE_URL`) |
| Lancer | `python manage.py runserver` (administration : `/admin/`) |
| Tests | `python manage.py test` |
| Lint et format | `ruff check . && ruff format --check .` |
| Types | `mypy` |
| Migrations à jour | `python manage.py makemigrations --check --dry-run` |

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
