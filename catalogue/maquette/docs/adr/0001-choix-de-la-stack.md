# ADR-0001 — Choix de la stack : maquette Vue 3

- **Statut** : Accepted
- **Date** : __DATE__
- **Décideurs** : __PO__, via ADA studio
- **Sujet** : stack technique du projet __NOM_PROJET__

## Contexte
__OBJECTIF__ Le projet est une maquette : valider un parcours avec des utilisateurs avant tout
développement. Seules les stacks d'ADA studio sont proposées.

## Options considérées
### Option A — Maquette Vue 3, données fictives, sans serveur
- Rapide à faire évoluer ; mêmes composants et même accessibilité que le futur service.
### Option B — Service complet (Vue 3 + API + base de données)
- **Pourquoi pas** : trop tôt ; on valide d'abord le parcours.

## Décision
**Option retenue : A.** Les données passent par des stores Pinia, pour être remplacées plus tard
par une vraie API sans réécrire les écrans.

## Conséquences
- **Positives** : itérations très rapides ; parcours accessible dès la maquette.
- **Négatives** : rien n'est enregistré ; la maquette n'est pas un service.
- **À surveiller** : le passage en service = nouvelle ADR et nouveau projet de type « service ».
