# ADR-0001 — Choix de la stack : Vue 3 + NestJS + PostgreSQL

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via l'atelier PO
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le projet démarre comme POC réalisé avec un assistant de code ; seules
les stacks d'ADA studio sont proposées. L'interface est accessible (RGAA) et n'imite aucun site officiel.

## Options considérées
### Option A — Vue 3 + NestJS + PostgreSQL
- Application métier structurée, nombreuses règles, durée de vie longue.
### Option B — Vue 3 + Node.js (Express)
- Plus léger, adapté à une API simple.
- **Pourquoi pas** : moins de structure quand les règles métier se multiplient.

## Décision
**Option retenue : A** — choix fait à la création du projet.

## Conséquences
- **Positives** : conventions, tests, accessibilité et CI de l'atelier disponibles d'emblée.
- **Négatives** : nécessite PostgreSQL (Docker en développement).
- **À surveiller** : un besoin hors du périmètre de la stack = nouvelle ADR.

## Suivi
- [x] Implémentation : création du projet depuis l'atelier PO
