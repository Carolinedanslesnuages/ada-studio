# ADR-0001 — Choix de la stack : extension Vue 3, Manifest V3

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le besoin se situe dans le navigateur de l'utilisateur, sur des pages qu'il utilise
déjà. Seules les stacks d'ADA studio sont proposées.

## Options considérées
### Option A — Extension Vue 3, Manifest V3, une seule base pour Chrome, Edge et Firefox
- Même outillage que les autres projets (Vue 3, Vitest, lint d'accessibilité).
- Permissions minimales au départ (`storage`), ajoutées une à une et justifiées.
### Option B — Service en ligne séparé
- **Pourquoi pas** : l'utilisateur devrait quitter la page sur laquelle il travaille.

## Décision
**Option retenue : A.** Une interface sobre, propre à l'extension.

## Conséquences
- **Positives** : au plus près du travail de l'utilisateur ; un seul code pour trois navigateurs.
- **Négatives** : publication dans les magasins d'extensions à prévoir (ou déploiement par le service informatique).
- **À surveiller** : chaque nouvelle permission (accès aux sites, onglets) = une ADR.

## Suivi
- [x] Implémentation : création du projet depuis ADA studio
