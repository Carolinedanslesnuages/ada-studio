# ADR-0001 — Choix de la stack : composant web (Vue 3, Shadow DOM)

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le besoin doit s'afficher dans des pages existantes, gérées par d'autres. Seules les
stacks d'ADA studio sont proposées.

## Options considérées
### Option A — Web component Vue 3 (`defineCustomElement`), un seul fichier JavaScript
- Une balise à coller, quel que soit l'outil du site hôte ; styles isolés (Shadow DOM).
### Option B — Une page à intégrer par `<iframe>`
- **Pourquoi pas** : hauteur à gérer, mal intégré visuellement, échanges avec la page plus difficiles.

## Décision
**Option retenue : A.** Styles isolés à l'intérieur : la page hôte garde sa propre apparence.

## Conséquences
- **Positives** : intégration en deux lignes ; aucun conflit de styles avec le site hôte.
- **Négatives** : Vue est inclus dans le fichier (environ 32 ko compressés).
- **À surveiller** : le contrat (attributs, événements, variables CSS) ; tout changement incompatible
  est annoncé (`feat!:`), car il casse les sites qui l'intègrent.

## Suivi
- [x] Implémentation : création du projet depuis ADA studio
