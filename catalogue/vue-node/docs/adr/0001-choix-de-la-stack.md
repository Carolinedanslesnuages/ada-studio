# ADR-0001 — Choix de la stack : Vue 3 + Node.js (Express) + SQLite

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le projet démarre comme POC réalisé avec un assistant de code ; seules
les stacks d'ADA studio sont proposées. L'interface est accessible (RGAA) et n'imite aucun site officiel.

## Options considérées
### Option A — Vue 3 + Node.js (Express) + SQLite
- Petite application, peu de règles : une API légère, sans compilation, une base dans un fichier.
### Option B — Vue 3 + NestJS + PostgreSQL
- Plus de structure (modules, injection), base serveur.
- **Pourquoi pas** : plus lourd que nécessaire pour un besoin simple.

## Décision
**Option retenue : A** — choix fait à la création du projet.

## Conséquences
- **Positives** : démarrage immédiat, aucune base à installer ; tests, accessibilité et CI d'ADA d'emblée.
- **Négatives** : SQLite convient à un usage modéré (un serveur, peu d'écritures simultanées).
- **À surveiller** : beaucoup d'utilisateurs simultanés ou de règles métier = passer à NestJS +
  PostgreSQL (nouvelle ADR).

## Suivi
- [x] Implémentation : création du projet depuis ADA studio
