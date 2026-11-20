# ADR-0010 — Reprise d'un projet existant : un propriétaire par projet, une PR de reprise

- **Statut** : Accepted
- **Date** : 2026-11-17
- **Décideurs** : responsable d'ADA
- **Sujet** : faire entrer dans ADA un dépôt qu'elle n'a pas créé (#37), de l'organisation ou du
  compte personnel du PO

## Contexte
Jusqu'ici, tous les projets appartenaient à un seul compte (`GITHUB_PROPRIETAIRE`) et étaient créés
par ADA depuis le catalogue. Un PO veut aussi faire évoluer avec ADA un POC déjà commencé, parfois
dans son propre compte GitHub.

## Décision
1. **Un propriétaire par projet.** L'identifiant d'un projet dans ADA reste son nom pour
   l'organisation d'ADA (adresses et aperçus existants inchangés) et devient `compte~nom` ailleurs
   (`~` n'existe ni dans un login ni dans un nom de dépôt GitHub). Toutes les routes
   `projets/:depot` passent par `ProjetGuard` : un PO n'ouvre que les projets de l'organisation et
   de **son** compte ; ses droits GitHub s'appliquent en plus.
2. **Stack facultative, analyse obligatoire.** ADA enregistre dans le projet, au nom du PO, une
   demande d'analyse (ADR-0009), puis l'assistant analyse le projet en lecture seule **comme
   s'il avait été créé avec ADA** : harnais (AGENTS.md, tests dont accessibilité, lint, CI,
   anti-fuite, ADR, aperçu) et attentes des skills (stories courtes, tests d'abord, test qui
   reproduit un bug, fiche de revue). Il rend un bilan court, 2 à 8 améliorations sous forme de
   stories (proposées comme un découpage : le PO coche celles à publier) et la description de
   l'aperçu (`ada.json`), déduite du projet. Une stack indiquée par le PO sert de point de départ
   et de repli si l'aperçu déduit est invalide ; sans l'un ni l'autre, un développeur le décrit.
3. **ADA propose, le PO valide.** À la fin de l'analyse, ADA ouvre une PR « chore: reprise du
   projet par ADA » depuis `ada/reprise`, avec les seuls fichiers manquants : formulaires de story
   et de signalement, vérification du titre des PR, release-please, et `ada.json` (seul contrôle
   exigé : le titre de PR ; la CI du projet reste la sienne). Rien n'arrive sur `main` sans la
   fusion du PO.
4. **Apparence du projet gardée** : du code existant garde son design. `ada.json` porte
   `"edition": "studio"`, sans `"style"` ni `"composants"` : l'assistant réutilise alors les
   composants du projet et n'introduit aucune bibliothèque d'interface (l'accessibilité RGAA reste
   exigée).
5. **Le projet entre dans ADA quand `ada.json` est sur `main`** ; ADA ajoute alors le topic `ada`
   et garde `ada-reprise`, qui distingue un projet repris d'un projet créé par ADA.
6. **Annuler ou désynchroniser, sans rien supprimer** (confirmation demandée) :
   - reprise pas encore validée → « Annuler la reprise » : PR fermée, branche `ada/reprise` retirée,
     demande d'analyse close avec une explication, marquage retiré ; `main` n'a jamais été modifié ;
   - reprise validée → « Désynchroniser d'ADA » : seuls les topics d'ADA sont retirés ; fichiers,
     stories et versions ajoutés par ADA restent dans le projet.
   Un projet créé par ADA n'a ni l'un ni l'autre.

## Options écartées
- **Pousser directement sur `main`** : contraire à la règle « le PO valide tout ».
- **Projets sans identifiant de compte (nom seul)** : deux dépôts de même nom (organisation et
  compte perso) se confondraient.
- **Adapter automatiquement le projet à une stack** (réécrire sa structure) : trop intrusif ; les
  écarts deviennent des stories que le PO choisit.
- **Stack obligatoire** : un PO qui reprend du code ne sait pas toujours laquelle choisir ; l'analyse
  la déduit.

## Conséquences
- La branche principale doit s'appeler `main` (ADA y travaille) ; sinon la reprise est refusée
  avec une explication.
- Marquer un dépôt demande d'en être administrateur.
- ADA ne voit que les dépôts où son application GitHub est installée : l'écran de reprise indique
  comment l'autoriser sur un compte personnel.
