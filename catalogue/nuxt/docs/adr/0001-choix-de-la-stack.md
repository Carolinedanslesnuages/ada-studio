# ADR-0001 — Choix de la stack : site Nuxt, pages générées

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le projet démarre comme POC réalisé avec un assistant de code ; seules
les stacks d'ADA studio sont proposées. Le site est public : il doit être bien référencé par les moteurs
de recherche, être accessible et publier sa déclaration d’accessibilité.

## Options considérées
### Option A — Nuxt 4, pages générées à l’avance (`nuxt generate`), CSS maison
- Chaque page est un fichier HTML complet (titre, description) : bon référencement, affichage
  immédiat, hébergement statique.
### Option B — Vue 3 (application d’une seule page)
- **Pourquoi pas** : le contenu n’existe qu’après exécution du JavaScript : moins bien référencé.
### Option C — VitePress
- **Pourquoi pas** : adapté à de la documentation, moins à un site aux pages libres.

## Décision
**Option retenue : A** — choix fait à la création du projet.

## Conséquences
- **Positives** : référencement, gabarit commun (en-tête, pied de page), accessibilité
  de chaque page générée vérifiée automatiquement.
- **Négatives** : un contenu qui change à chaque visite demande une API (hors de ce modèle).
- **À surveiller** : formulaires ou données dynamiques = nouvelle ADR (API, rendu côté serveur).

## Suivi
- [x] Implémentation : création du projet depuis ADA studio
