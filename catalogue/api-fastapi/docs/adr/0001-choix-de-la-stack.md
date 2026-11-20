# ADR-0001 — Choix de la stack : API Python (FastAPI) + PostgreSQL

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le projet démarre comme POC réalisé avec un assistant de code ; seules
les stacks d'ADA studio sont proposées. Le besoin est une API, sans écran.

## Options considérées
### Option A — Python : FastAPI + PostgreSQL, documentation OpenAPI
- Adapté aux calculs et à la donnée ; validation et documentation générées à partir des types.
### Option B — NestJS + PostgreSQL
- Stack de référence de l'équipe.
- **Pourquoi pas** : le besoin (données, calculs, bibliothèques Python) appelle Python.

## Décision
**Option retenue : A** — choix fait à la création du projet.

## Conséquences
- **Positives** : conventions, tests, documentation OpenAPI et CI d'ADA disponibles d'emblée.
- **Négatives** : nécessite PostgreSQL (Docker en développement).
- **À surveiller** : un besoin hors du périmètre de la stack = nouvelle ADR.

## Suivi
- [x] Implémentation : création du projet depuis ADA studio
