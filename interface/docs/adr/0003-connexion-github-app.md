# ADR-0003 — Connexion par GitHub App, au nom du PO, avec liste blanche

- **Statut** : Accepted
- **Date** : 2026-11-16
- **Décideurs** : équipe ADA
- **Sujet** : authentification et droits de l'interface

## Contexte
Les actions (issues, branches, fusions) doivent être tracées au nom du PO. L'agent exécutera du
code : l'accès à l'interface doit être restreint.

## Options considérées
### Option A — GitHub App, jeton utilisateur (expirant)
- Droits effectifs = intersection des permissions de l'App et des droits du PO ; jetons qui expirent.
### Option B — OAuth App classique
- **Pourquoi pas** : jetons sans expiration, portée large (`repo`).
### Option C — Jeton personnel saisi par le PO
- **Pourquoi pas** : manipulation risquée pour un non-développeur, aucune expiration imposée.

## Décision
**Option retenue : A.** Webhook inactif tant que l'interface tourne en local. Liste blanche
`LOGINS_AUTORISES` vérifiée au retour de GitHub (par défaut : le seul propriétaire).

## Conséquences
- **Positives** : traçabilité, moindre privilège, pas de secret manipulé par le PO.
- **Négatives** : la permission *Administration* (topics, réglages Actions) est puissante.
- **À surveiller** : secret de webhook à vérifier dès que l'interface aura une URL publique.
  (Le renouvellement du jeton est en place depuis le 2026-11-16 : garde de connexion.)
