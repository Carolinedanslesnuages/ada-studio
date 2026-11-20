# ADR-0001 — Choix de la stack : Vue 3 + Python (FastAPI) + PostgreSQL

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le projet démarre comme POC réalisé avec un assistant de code ; seules
les stacks d'ADA studio sont proposées. L'interface est accessible (RGAA) et n'imite aucun site officiel.

## Options considérées
### Option A — Vue 3 + Python (FastAPI) + PostgreSQL
- Interface Vue 3 ; API Python typée, documentée (OpenAPI), adaptée aux données,
  aux calculs, à l'import ou l'export de fichiers et à l'IA.
### Option B — Vue 3 + NestJS + PostgreSQL
- Une seule langue (TypeScript) du front à l'API.
- **Pourquoi pas** : l'écosystème Python est plus riche pour les traitements de données.

## Décision
**Option retenue : A** — choix fait à la création du projet.

## Conséquences
- **Positives** : bibliothèques Python de données et d'IA disponibles ; tests, accessibilité et CI d'ADA d'emblée.
- **Négatives** : deux langues (TypeScript et Python), deux jeux d'outils.
- **À surveiller** : traitements longs (au-delà de quelques secondes) = tâche de fond (nouvelle ADR).

## Suivi
- [x] Implémentation : création du projet depuis ADA studio
