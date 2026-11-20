# Guide du PO — Atelier

## Ouvrir l'atelier
1. Double-cliquez sur le fichier **`ada.code-workspace`**.
2. Cliquez sur l'icône Claude (en haut à droite de l'éditeur) pour ouvrir le panneau de discussion.

Vous n'avez besoin que de ce panneau. Vous n'avez pas à ouvrir ni à modifier de fichiers.

## Créer un projet
Tapez :
```
/po-projet-nouveau
```
L'assistant vous demande, une étape à la fois :
1. le **nom** du projet ;
2. son **objectif** en une ou deux phrases ;
3. la **stack** (répondez par le numéro) ;
4. le **style** de l'interface et sa **bibliothèque de composants** (CSS maison sans bibliothèque par défaut).

Il vous montre un récapitulatif. Rien n'est créé avant votre « oui ».

## Faire réaliser une user story
Tapez `/po-story` suivi de votre story :
```
/po-story En tant qu'agent d'accueil, je veux voir la liste des salles libres
aujourd'hui, afin de proposer une salle à un visiteur sans appeler le service.

Critères d'acceptation :
- seules les salles sans réservation sur le créneau en cours apparaissent ;
- pour chaque salle : nom, étage, nombre de places ;
- si aucune salle n'est libre, un message l'indique clairement.
```

Ensuite :
- **S'il vous pose des questions**, c'est normal : votre story laisse une règle ouverte.
  Répondez simplement.
- **Il vous propose un plan.** Relisez-le : c'est votre dernier moment pour corriger
  avant la réalisation. Répondez « oui » pour lancer.
- **À la fin**, la story attend la relecture d'un développeur. Elle n'est pas
  mise en production automatiquement.

## Autoriser les versions automatiques (une fois par projet)
Chaque projet publie ses versions tout seul (outil « release-please »). Il faut l'autoriser
une fois, sur GitHub :
1. Ouvrez le dépôt du projet → **Settings** → menu de gauche **Actions** → **General**.
2. Tout en bas, **Workflow permissions** : cochez **Read and write permissions** et
   **Allow GitHub Actions to create and approve pull requests**, puis **Save**.
3. Cases grisées ? Un administrateur de l'organisation doit l'autoriser (Settings de
   l'organisation → Actions → General).

Ensuite, une pull request « release » apparaît après chaque fonctionnalité livrée :
fusionnez-la quand vous voulez publier une version.

## Une bonne story, c'est…
| Élément | Exemple |
|---|---|
| Un rôle | En tant qu'agent d'accueil… |
| Un besoin | …je veux voir les salles libres aujourd'hui… |
| Un bénéfice | …afin de proposer une salle sans appeler le service. |
| Des critères vérifiables | « Si aucune salle n'est libre, un message l'indique. » |

Une story = un besoin. Si vous écrivez « et » plusieurs fois, c'est probablement deux stories.
