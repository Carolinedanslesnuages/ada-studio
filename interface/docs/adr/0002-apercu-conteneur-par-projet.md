# ADR-0002 — Aperçu en direct : un conteneur par projet

- **Statut** : Accepted
- **Date** : 2026-11-16
- **Décideurs** : équipe ADA
- **Sujet** : comment le PO voit son produit pendant que l'agent le construit

## Contexte
Le PO doit voir le résultat au même endroit que la conversation (comme les générateurs
d'applications du marché), avoir plusieurs projets en parallèle, sans aide d'un développeur.

## Options considérées
### Option A — Un conteneur Docker par projet sur le serveur de l'interface
- Toutes les stacks (Node, Python, PostgreSQL) ; rechargement à chaud ; isolation.
### Option B — WebContainers (exécution dans le navigateur)
- **Pourquoi pas** : Node seulement (ni Python ni PostgreSQL), licence payante en usage professionnel.
### Option C — Hébergement « serverless » (type Vercel)
- **Pourquoi pas** : ni Docker ni processus longs ; l'agent et l'aperçu ne peuvent pas y tourner.

## Décision
**Option retenue : A**, avec mise en veille après 30 minutes d'inactivité, limites par conteneur
(1,5 Go, 1 processeur), 3 projets actifs par PO, file d'attente pour les agents, base PostgreSQL
partagée (une base par projet), conteneurs sans droits root ni accès au socket Docker.

## Conséquences
- **Positives** : environ 1 Go par projet actif ; un serveur de 16 à 32 Go suffit pour une dizaine de PO.
- **Négatives** : un serveur à administrer (VM) ; code généré par IA exécuté côté serveur.
- **À surveiller** : au-delà d'une trentaine de projets actifs, passer sur Kubernetes.

## Mise à jour (2026-11-18) — ce que le code fait vraiment
La décision ci-dessus annonçait plus que ce qui était construit. État réel :
- **Fait** : un conteneur par projet, mise en veille après 30 minutes, limites par conteneur
  (1,5 Go et 1 processeur pour l'application, 256 Mo pour PostgreSQL), pas d'accès au socket Docker,
  file d'attente et plafond d'agents (voir ADR-0004), dossier git du projet rangé hors du dossier
  monté dans le conteneur, `ada.json` validé strictement (image, dossiers).
- **Pas fait** : « 3 projets actifs par PO » (aucun quota par PO) ; « base PostgreSQL partagée,
  une base par projet » (chaque projet a son propre PostgreSQL de 256 Mo) ; « sans droits root »
  (le script de démarrage s'exécute en root pour donner les volumes à l'utilisateur 1000, puis
  passe en utilisateur non privilégié).
- **Limite** : 100 ports (5300-5399) attribués à vie, sur 127.0.0.1 : l'aperçu n'est joignable que
  depuis la machine d'ADA. Une mise en ligne exige un proxy authentifié par projet et la
  libération des ports des projets en veille.

