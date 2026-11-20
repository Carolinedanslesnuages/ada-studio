# ADR-0004 — L'assistant tourne dans un processus travailleur détaché

- **Statut** : Accepted
- **Date** : 2026-11-16
- **Décideurs** : équipe ADA
- **Sujet** : où s'exécute le travail de l'assistant (analyse, réalisation)

## Contexte
L'assistant était un sous-processus de l'API : un redémarrage de l'API (mise à jour, panne,
mode développement) l'interrompait en pleine réalisation, laissant un travail à moitié écrit.
C'est arrivé le 2026-11-16 sur une story réelle.

## Options considérées
### Option A — Processus travailleur détaché, un par tâche
- Survit aux redémarrages de l'API ; fait tout le cycle (agent, issue, push, PR).
- Verrou par projet sur disque (numéro de processus) : une demande à la fois, entre processus.
### Option B — File de messages (Redis, BullMQ) et un service de travailleurs
- **Pourquoi pas maintenant** : une brique de plus à héberger pour un usage encore local.
### Option C — Garder le sous-processus et interdire les redémarrages pendant le travail
- **Pourquoi pas** : une panne ou une mise à jour reste possible ; la règle ne protège rien.

## Décision
**Option A.** La tâche (dont le jeton du PO) est transmise par un fichier lisible par le seul
utilisateur, supprimé dès sa lecture. Un verrou tenu par un processus mort est ignoré, et la
reprise d'un travail interrompu sur la même branche est prévue.

## Conséquences
- **Positives** : redémarrer l'API n'interrompt plus personne ; journal par tâche
  (`agent/<numéro>.travailleur.log`).
- **Négatives** : plusieurs processus à superviser ; le jeton passe brièvement par le disque.
- **À surveiller** : au-delà de quelques PO simultanés, passer à l'option B (file d'attente).

## Mise à jour (2026-11-18) — plafond d'agents, file d'attente, verrou qui bat
- **Plafond et file** : au plus `AGENT_MAX_SIMULTANES` agents (3 par défaut) travaillent en même
  temps sur la machine. Les tâches suivantes attendent dans `apercus/.file-attente/` (un fichier
  par projet, lisible par le seul utilisateur, avec le jeton du PO), démarrent dans l'ordre
  d'arrivée, et sont abandonnées après 30 minutes d'attente (le PO relance depuis l'écran).
  Une file de fichiers, sans Redis : elle suffit pour une seule instance de l'API.
  **À surveiller** : plusieurs instances de l'API, ou plusieurs serveurs, imposeront l'option B.
- **Verrou** : le processus qui le tient le « touche » toutes les 30 s ; sans signe de vie depuis
  2 minutes il est abandonné, même si son numéro de processus existe encore (numéro réutilisé
  après un redémarrage). Un verrou abandonné est remplacé sous un garde de reprise exclusif : deux
  tâches qui le trouvent mort en même temps ne peuvent pas le reprendre toutes les deux.
- **Ordre des opérations** : ADA vérifie qu'elle peut démarrer (agent configuré, nom du projet,
  projet libre) AVANT d'écrire quoi que ce soit dans GitHub ; un démarrage qui échoue rend le
  verrou et laisse l'erreur visible avec « Relancer ADA ».
- **Jeton** : renouvelé dès qu'il lui reste moins de 2 heures, pour qu'une tâche lancée garde un
  jeton valide jusqu'à l'ouverture de sa PR ; les requêtes simultanées partagent un seul renouvellement.

