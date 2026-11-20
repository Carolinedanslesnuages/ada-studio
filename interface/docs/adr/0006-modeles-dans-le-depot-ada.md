# ADR-0006 — Les modèles de projet vivent dans le dépôt d'ADA

- **Statut** : Accepted
- **Date** : 2026-11-16
- **Décideurs** : équipe ADA
- **Sujet** : d'où vient le contenu d'un nouveau projet

## Contexte
ADA propose plusieurs types de projet (service, formulaire, extension de navigateur, maquette)
et, pour un service, plusieurs stacks. Jusqu'ici, chaque modèle était un dépôt GitHub marqué
*template* : un dépôt de plus par modèle, à créer, régler et maintenir à part, et une
génération GitHub asynchrone qu'il fallait attendre.

## Options considérées
### Option A — Un dossier par modèle dans le dépôt d'ADA (`catalogue/<modèle>/`)
- Un seul dépôt ; un modèle évolue avec l'outil, dans la même PR, avec la même revue.
- La CI d'ADA vérifie chaque modèle comme son futur projet (`scripts/verifier-modele.mjs`).
### Option B — Un dépôt modèle GitHub par modèle (méthode précédente)
- **Pourquoi pas** : autant de dépôts que de modèles, versionnés séparément d'ADA.
### Option C — Générer les projets avec un outil d'échafaudage (create-vue, nest new…) à la volée
- **Pourquoi pas** : résultat variable selon les versions publiées le jour même ; il faudrait
  ensuite ajouter le style, la CI, l'accessibilité et release-please à chaque fois.

## Décision
**Option A.** La création d'un projet :
1. crée un dépôt privé **vide** (topic provisoire `ada-creation`) ;
2. applique les réglages avant tout push (squash seul, droits de release-please) ;
3. copie les fichiers suivis par git de `catalogue/<modèle>/`, remplace les marqueurs dans les
   fichiers listés par `ada.json` (`personnaliser`), et pousse **un seul commit** au nom du PO ;
4. protège `main` avec les contrôles requis de `ada.json`, pose le topic `ada`, puis les labels.

Chaque étape est rejouable : relancer la création avec le même nom reprend là où elle s'était
arrêtée (y compris pour un dépôt créé par l'ancienne méthode). Un type de projet n'est proposé
que si `catalogue/<modèle>/ada.json` existe.

## Conséquences
- **Positives** : aucun dépôt modèle à créer ni à maintenir ; un modèle n'apparaît dans ADA
  qu'une fois livré et vérifié par la CI ; création plus rapide (plus d'attente de génération).
- **Négatives** : le dépôt d'ADA grossit avec chaque modèle ; ADA doit pouvoir lancer `git`
  (déjà le cas pour l'aperçu).
- Les anciens dépôts modèles GitHub ne servent plus ; leur archivage relève du propriétaire.
