# ADR-0001 — Choix de la stack : quiz Vue 3, sans serveur

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le besoin est d'apprendre ou de s'auto-évaluer avec des questions. Seules les stacks
d'ADA sont autorisées.

## Options considérées
### Option A — Vue 3, questions dans un fichier, sans serveur
- Simple à héberger ; un non-développeur peut relire et proposer des questions (un seul fichier).
### Option B — Avec un serveur (comptes, suivi des résultats)
- **Pourquoi pas** : inutile pour s'entraîner ; à ajouter si le suivi des résultats devient un besoin.

## Décision
**Option retenue : A.**

## Conséquences
- **Positives** : questions faciles à faire évoluer ; parcours accessible.
- **Négatives** : aucun résultat n'est conservé.
- **À surveiller** : suivi des résultats ou certification = un serveur (nouvelle ADR).
