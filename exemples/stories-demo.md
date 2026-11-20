# Stories pour la démonstration

À utiliser sur un projet « Réservation de salles », stack 2 (Vue 3 + NestJS), CSS maison sans bibliothèque.

## 1. Story claire → parcours complet jusqu'à la demande de relecture
```
/po-story En tant qu'agent d'accueil, je veux voir la liste des salles libres
aujourd'hui, afin de proposer une salle à un visiteur sans appeler le service.

Critères d'acceptation :
- une salle est libre si aucune réservation ne couvre l'heure actuelle ;
- pour chaque salle libre : nom, étage, nombre de places, triées par nom ;
- si aucune salle n'est libre, un message l'indique clairement ;
- pour la démonstration, l'application contient quelques salles et
  réservations fictives.
```
Attendu : pas de question (tout est précisé). Le plan annonce que la structure
des données est créée (salles, réservations) : point de relecture pour un développeur.

> Note de répétition : avec la formulation « sur le créneau en cours » et sans
> données fournies, l'assistant s'arrête pour poser deux questions. C'est un bon
> comportement, mais ce n'est pas le but de cette première story.

## 2. Story floue → l'assistant s'arrête et pose des questions
```
/po-story Je veux que les gens puissent réserver une salle.
```
Attendu : pas de code. Des questions sur qui peut réserver, la durée,
les conflits de réservation, l'annulation.

## 3. Story qui touche aux données → garde-fou de relecture
```
/po-story En tant que gestionnaire, je veux pouvoir indiquer qu'une salle est
équipée d'un écran de visioconférence, afin que les agents puissent filtrer
les salles adaptées à une réunion à distance.

Critères d'acceptation :
- le gestionnaire peut cocher « visioconférence » sur la fiche d'une salle ;
- la liste des salles libres peut être filtrée sur ce critère.
```
Attendu : le plan annonce que la structure des données change et que
la migration devra être validée par un développeur.
