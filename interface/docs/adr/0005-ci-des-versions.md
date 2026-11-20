# ADR-0005 — Contrôles des PR de version : ni approbation automatique, ni clé dans les projets

- **Statut** : Accepted
- **Date** : 2026-11-16
- **Décideurs** : équipe ADA
- **Sujet** : les PR « release » ouvertes par release-please attendent une approbation humaine
  de leurs contrôles (« action_required »)

## Contexte
release-please ouvre ses PR avec le jeton du robot GitHub ; GitHub fait alors attendre leurs
workflows jusqu'à l'approbation d'un humain. ADA publie déjà une version sans ces contrôles,
mais seulement si la PR ne touche que les fichiers de version (aucun code).

## Options considérées
### Option A — ADA approuve automatiquement les exécutions en attente
- **Pourquoi pas** : cette approbation est un contrôle humain voulu par GitHub ; la contourner
  automatiquement supprime la supervision. Refusé aussi par les garde-fous de l'assistant de code.
### Option B — Clé privée de la GitHub App d'ADA en secret de chaque projet
- release-please agirait au nom de l'App : contrôles lancés sans attente.
- **Pourquoi pas** : le code des projets est écrit par l'agent et les workflows d'une branche
  du dépôt voient ses secrets ; la clé donne accès à tous les dépôts où l'App est installée.
### Option C — App dédiée minimale + secret d'environnement réservé à `main`
- Une seconde GitHub App « ADA versions » (Contents et Pull requests seulement), dont la clé est
  un secret de l'environnement `versions`, accessible aux seuls workflows de `main` ; jeton
  émis pour le seul dépôt courant.
- **Pas maintenant** : les environnements ne sont pas disponibles pour les dépôts privés d'un
  compte GitHub gratuit ; à mettre en place dans l'organisation (offre Team).
### Option D — Laisser en l'état, avec la règle de publication d'ADA
- Sans risque : une PR de version ne contient aucun code.

## Décision
**Option D maintenant, option C avec l'organisation.** En complément, durcissement immédiat :
l'agent ne peut plus modifier `.github/` (règles `Edit/Write(./.github/**)` interdites, vérifié
sur un essai réel) — il ne touche jamais aux contrôles qui le surveillent.

## Conséquences
- **Positives** : aucune clé exposée, supervision humaine conservée ; workflows hors d'atteinte
  de l'agent.
- **Négatives** : les PR de version affichent « en attente d'approbation » sur GitHub.
- **À surveiller** : passage en organisation Team → option C (App dédiée, environnement `versions`).
