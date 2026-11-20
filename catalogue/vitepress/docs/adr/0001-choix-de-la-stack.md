# ADR-0001 — Choix de la stack : documentation VitePress

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le projet démarre comme POC réalisé avec un assistant de code ; seules les stacks
d'ADA studio sont proposées. Il s'agit de pages de documentation, écrites et relues simplement.

## Options considérées
### Option A — VitePress, thème par défaut aux couleurs du projet
- Pages en Markdown, sommaire, menu et recherche intégrés ; site statique, sans serveur.
### Option B — Site Nuxt
- **Pourquoi pas** : chaque page serait un composant à coder ; plus lourd pour de la documentation.

## Décision
**Option retenue : A** — choix fait à la création du projet.

## Conséquences
- **Positives** : écrire une page = écrire un fichier Markdown ; chaque page construite est
  vérifiée automatiquement (liens, accessibilité).
- **Négatives** : en-tête, pied de page et composants restent ceux de VitePress ; thème clair
  seulement, sans bloc « page précédente / suivante » (problèmes d'accessibilité du thème de VitePress).
- **À surveiller** : besoin de pages interactives = modèle Nuxt (nouvelle ADR).

## Suivi
- [x] Implémentation : création du projet depuis ADA studio
