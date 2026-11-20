# ADR-0011 — L'état et la conversation d'une demande vivent dans ADA ; GitHub en reçoit une copie

- **Statut** : Accepted (remplace en partie les ADR-0001 et 0009)
- **Date** : 2026-11-18
- **Décideurs** : responsable d'ADA
- **Sujet** : qui fait foi pour décider ce qu'ADA fait : GitHub, ou ADA elle-même

## Contexte
Les ADR 0001 et 0009 faisaient de GitHub la source de vérité : statut dans des labels, échanges
dans les commentaires de l'issue, demande dans son corps. ADA écrit avec le jeton du PO : un
commentaire d'ADA et un commentaire écrit à la main par le PO (ou par n'importe quel membre du
dépôt) ont le même auteur. ADA relisait tous les commentaires, sans distinguer l'origine, et les
donnait à l'agent de code comme consignes du PO. Les labels de statut, que toute personne ayant
des droits sur le dépôt peut changer, ouvraient ou fermaient les étapes (« plan à valider »…).
Un membre du dépôt qui n'utilise pas ADA pouvait donc faire dévier ADA, et à travers elle l'agent,
qui agit avec les droits du PO (push, PR).

## Options considérées
### Option A — Durcir sur place (filtrer par droits, signer les commentaires)
- **Pourquoi pas seule** : un membre qui a le droit d'écrire passe le filtre, et les signatures
  imposent de toute façon qu'ADA se souvienne de ce qu'elle a émis (donc de garder un état).
### Option B — Écrire avec une identité distincte (App d'ADA, `ada[bot]`)
- **Pourquoi pas maintenant** : demande une clé privée de plus sur le serveur et change la promesse
  « à votre nom » ; les labels et le corps de l'issue restent ouverts. Reste possible ensuite.
### Option C — L'état vit dans ADA, GitHub reçoit une copie et le résultat
- ADA garde la demande telle qu'elle était au lancement, le journal de ce que ADA et le PO se
  sont dit par l'interface, et le statut. Un commentaire, un label ou un corps d'issue écrits ailleurs
  n'entrent jamais dans ses décisions.

## Décision
**Option C**, dans `api/src/stories/demandes.ts` (fichiers sous `apercus/<projet>/demandes/`) :
- **Demande figée** au lancement (titre, type, contenu) : l'agent la lit, jamais l'issue vivante.
- **Journal des échanges** : écrit par l'interface (messages d'ADA, réponses du PO, validations).
  L'écran l'affiche aussi : un faux message imitant ADA n'y paraît pas.
- **Statut** enregistré par ADA ; le label GitHub est recopié pour la lecture, jamais relu. Au
  premier passage sur un projet, les labels déjà posés sont repris une fois. Une issue fermée
  reste « livrée ».
- **Demandes déjà lancées avant ce changement** : reprises une fois depuis GitHub, en ne gardant
  que les auteurs qui ont le droit d'écrire (`stories/confiance.ts`) ; ensuite, GitHub n'est plus relu.
- **Branche** : ADA note le dernier commit qu'elle a poussé ; la fusion est refusée si la branche a
  avancé autrement (`verification.service.ts`).

## Conséquences
- **Positives** : ce qui est écrit hors de l'interface d'ADA ne peut plus l'influencer ; un état
  propre à ADA prépare la mise en ligne.
- **Négatives** : GitHub n'est plus la source de vérité de la conversation ni du statut ; une
  réponse écrite directement dans l'issue n'est pas vue par ADA (le PO doit répondre dans ADA) ; la
  copie GitHub peut dériver (une recopie de label qui échoue est seulement journalisée).
- **Limites connues** : les issues (corps, titre) restent lues sur GitHub avant le lancement : c'est
  le PO qui les relit à l'écran puis clique « Lancer ». L'état est dans des fichiers locaux
  (une seule instance d'ADA) : une base de données le remplacera, `DemandesStore` est le seul à
  connaître le stockage. `ada.json`, `AGENTS.md`, `PROJET.md`, les workflows et les titres de PR
  restent des fichiers du dépôt que d'autres peuvent modifier ; une approbation obligatoire
  casserait l'autonomie d'un PO seul (l'auteur d'une PR ne peut pas l'approuver), elle reste à
  décider pour les projets à plusieurs.

## Mise à jour (2026-11-19) — relecture « injection de consigne »
Une relecture du code a confirmé la promesse pour toute demande lancée depuis cette décision, et
corrigé ce qui restait ouvert : l'empreinte est obligatoire au lancement et « prête » se juge sur
l'issue qui va être figée ; une demande d'un auteur sans droit d'écriture n'est confiée à l'agent
ni à la validation du plan, ni à une réponse, ni à une relance (chemin d'héritage des demandes
d'avant cette décision) ; `.claude/`, `.agents/` et `.mcp.json` rejoignent les chemins réservés qui
bloquent l'envoi d'une branche (l'agent écrit librement dans le dépôt monté depuis le conteneur) ;
une skill apportée par le dépôt passe le contrôle `skillSure` et ne remplace jamais une skill d'ADA ;
chaque consigne rappelle que le texte de la demande et des fichiers du projet est une donnée. Le
banc d'essai couvre l'injection par le titre, les autres stories, les fichiers du projet, un critère
de réalisation et les stories proposées. Reste accepté, par le modèle de confiance : ce qu'écrit un
compte ayant le droit d'écrire, et ce qu'un PO fusionne (`AGENTS.md`, `README`, `ada.json`).

## Mise à jour (2026-11-18) — protection de la branche principale
Les projets Gladys et signalements, créés par ADA, n'avaient aucune protection sur `main` : la
création l'avait tentée, avait échoué (signalements était alors privé, sur un compte gratuit) et
rien ne la retentait. Désormais, à l'ouverture d'un projet, ADA vérifie les règles en vigueur sur
`main` et pose la sienne si aucune n'exige de PR (`ProjetsService.assurerProtection`) ; un refus de
GitHub est expliqué au PO et son motif exact journalisé. Un projet repris garde les règles de son
équipe : ADA ne pose rien d'elle-même, elle propose de protéger la branche et le PO décide (protéger
change la façon de travailler de toute l'équipe du dépôt) ; un refus est retenu par ADA, et le PO
peut revenir sur son choix. Les contrôles exigés avant fusion se lisent dans cette règle de GitHub,
plus dans `ada.json` (qui ne sert qu'à défaut de règle).

