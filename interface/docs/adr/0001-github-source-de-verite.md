# ADR-0001 — GitHub comme source de vérité des stories

- **Statut** : Accepted — remplacé en partie par l'[ADR-0011](0011-etat-des-demandes-dans-ada.md) (la conversation et le statut vivent dans ADA)
- **Date** : 2026-11-16
- **Décideurs** : équipe ADA
- **Sujet** : où vivent les stories et leur statut

## Contexte
Les PO ont un compte GitHub ; les développeurs suivent déjà le travail dans GitHub. L'interface
doit montrer stories, conversation et statut sans créer un second référentiel à synchroniser.

## Options considérées
### Option A — Issues GitHub (labels `user-story`, `bug`, `story:*`)
- Un seul référentiel, traçabilité native (PR liée par `Closes #n`), utilisable sans l'interface.
### Option B — Base de données propre à l'interface
- **Pourquoi pas** : double saisie ou synchronisation, et les développeurs n'y ont pas accès.

## Décision
**Option retenue : A.** L'interface ne stocke que la session ; tout le reste est lu et écrit
dans GitHub, au nom du PO connecté.

## Conséquences
- **Positives** : aucune base à administrer ; modèles d'issues GitHub au même format que l'interface.
- **Négatives** : dépendance aux limites de l'API GitHub (5 000 requêtes/heure par utilisateur).
- **À surveiller** : temps de chargement de la liste au-delà de 100 issues (pagination à ajouter).
