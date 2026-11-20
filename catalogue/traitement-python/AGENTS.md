# __NOM_PROJET__ — instructions pour les agents de code

Lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe pour Claude Code.

Objectif : __OBJECTIF__

## Conventions
- **Noms explicites** : chaque variable, fonction, paramètre ou classe dit ce qu'il contient ou
  fait, en toutes lettres et en français (`lignes_retenues`, `raison_de_rejet`), jamais `x`, `s`,
  `tmp`, `data2`. Seuls les noms imposés par les bibliothèques restent tels quels.
- Python 3.13. Le traitement est un paquet `traitement/` lancé par `python -m traitement` :
  `lecture.py` (fichiers d'entrée), `regles.py` (règles métier, **fonctions pures**),
  `ecriture.py` (fichier de sortie et rapport), `__main__.py` (enchaînement).
- **Une règle métier = une fonction de `regles.py`, testée** ; une ligne écartée l'est toujours
  avec sa raison, en français, affichée dans le rapport.
- **Rapport** (`rapport/index.html`, ce que montre l'aperçu) : page autonome en français,
  lisible par tous (RGAA) : `lang="fr"`, un seul `h1`, titres sans saut de niveau, tableaux avec
  `caption` et en-têtes `scope="col"`, texte échappé (`html.escape`), jamais d'information par la
  couleur seule.
- Types partout : mypy en mode strict, la CI échoue sinon. Lint et format : ruff.
- Tout critère d'acceptation se traduit par au moins un test pytest (`tests/test_<sujet>.py`).
- **Données** : uniquement fictives dans `donnees/entree/` ; `donnees/sortie/` et `rapport/` sont
  régénérés (jamais commités). Jamais de donnée réelle ou personnelle dans le dépôt.
- Dépendances : versions figées dans `requirements.txt` (traitement) et `requirements-dev.txt`
  (outils) ; une nouvelle dépendance est justifiée dans la fiche.

## Commandes
| Action | Commande |
|---|---|
| Environnement | `python3.13 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt` |
| Traiter | `python -m traitement [fichier.csv]` |
| Tests | `pytest` |
| Lint et format | `ruff check . && ruff format --check .` |
| Types | `mypy` |

## Messages de commit (release-please)
Conventional Commits, versions SemVer calculées par release-please (jamais à la main) :
`fix: …` → correctif (0.2.0 → 0.2.1), `feat: …` → fonctionnalité (0.2.0 → 0.3.0),
`feat!: …` ou `BREAKING CHANGE:` → changement incompatible (majeure ; mineure avant 1.0.0),
`test:`, `docs:`, `chore:`, `refactor:` → sans nouvelle version. Fusion en squash : le
**titre de la PR** devient le commit de `main` (contrôle « Titre de PR » en CI). Story issue
d'une issue GitHub : `Closes #<numéro>` dans le corps.

## Règles absolues
- **Un fichier, une responsabilité** : au plus 400 lignes non vides par fichier de code, 600 par fichier de test (contrôle « Taille des fichiers » en CI). Découper par responsabilité, jamais une fonction par fichier ; un fichier déjà trop long ne grossit plus.
- Ne jamais modifier `.github/` (dont la planification du traitement).
- Aucune donnée réelle, aucun secret dans le dépôt (gitleaks bloque en CI, et en local une fois `pre-commit install` lancé ; `--no-verify` interdit).
- Une branche par story (`story/…`) ou par bug (`fix/…`) ; jamais de fusion par l'agent.
- Les décisions d'architecture sont tracées dans `docs/adr/`.
