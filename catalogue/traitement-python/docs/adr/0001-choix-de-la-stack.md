# ADR-0001 — Choix de la stack : traitement en Python

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le projet démarre comme POC réalisé avec un assistant de code ; seules
les stacks d'ADA studio sont proposées. Il n'a pas d'écran : il lit des fichiers, applique des règles et
produit un fichier nettoyé et un rapport.

## Options considérées
### Option A — Python 3.13, scripts planifiés par la CI
- Bibliothèque standard riche (CSV, dates, texte) ; pandas ou openpyxl possibles si le besoin le
  justifie. Exécution planifiée par GitHub Actions, sans serveur à maintenir.
### Option B — API (FastAPI) qui reçoit les fichiers
- **Pourquoi pas** : un service à héberger, inutile pour un traitement périodique.

## Décision
**Option retenue : A** — choix fait à la création du projet.

## Conséquences
- **Positives** : aucun serveur ; résultat et rapport archivés à chaque exécution ; tests et CI d'ADA d'emblée.
- **Négatives** : pas d'interface pour déposer un fichier (le fichier est dans le dépôt ou fourni à la demande).
- **À surveiller** : données réelles ou personnelles = jamais dans le dépôt (stockage dédié, nouvelle ADR).

## Suivi
- [x] Implémentation : création du projet depuis ADA studio
