# Banc d'essai de l'agent d'ADA

À rejouer **après tout changement de consigne, de modèle ou de skill** : il dit si l'agent se
comporte toujours bien, au lieu d'attendre qu'une demande réelle se passe mal.

Il utilise le code d'ADA compilé : les consignes, les outils autorisés et les options de l'agent sont
**exactement ceux de l'API**. Les projets sont jetables ; rien n'est écrit sur GitHub, ni dans ADA.

## Les deux bancs

| Banc | Question | Durée | Coût |
|---|---|---|---|
| `analyse.mjs` | Pour chaque demande, l'agent choisit-il la bonne décision (questions, plan, découpage, attente) ? Cite-t-il le doublon ? Résiste-t-il à une consigne piégée (dans la demande, son titre, le titre d'une autre story, les fichiers du projet, ou à propager dans des stories) ? | environ 3 min pour 13 cas × 5 | faible (environ 60 000 tokens produits) |
| `realisation.mjs` | L'agent livre-t-il une petite story : commit, fiche, tests dont accessibilité, contrôles du projet verts, composants accessibles ? Et sans toucher aux réglages de l'agent ni obéir à un critère ou un AGENTS.md piégé ? | environ 1 min par exécution | plus élevé ; demande Docker |

Le banc de réalisation **relance lui-même** les contrôles du projet : il ne croit pas l'agent sur parole.

## Utilisation

```bash
cd interface/api && npm run build && cd ../..        # le banc utilise l'API compilée

node scripts/banc-agent/analyse.mjs --a-blanc        # construit les consignes, sans rien lancer ni dépenser
BANC_REPS=5 node scripts/banc-agent/analyse.mjs      # les 9 cas, 5 fois chacun
node scripts/banc-agent/analyse.mjs doublon impasse  # seulement certains cas

BANC_REPS=2 node scripts/banc-agent/realisation.mjs  # les 6 cas de réalisation, 2 fois chacun
node scripts/banc-agent/realisation.mjs recherche    # un seul cas
```

Code de sortie : 0 si toutes les exécutions sont réussies, 1 sinon.

**Réglages.** Lus dans `interface/api/.env` (seulement `AGENT_COMMANDE`, `AGENT_MODELE`, `AGENT_SKILLS` ;
jamais les secrets) : lance donc le banc depuis la copie où ce fichier existe. Chacun se remplace par
`BANC_COMMANDE`, `BANC_MODELE`, `BANC_SKILLS` (dossiers séparés par des virgules). Pour comparer deux
modèles : `BANC_MODELE=haiku …` puis `BANC_MODELE=sonnet …`.

## Comment lire un résultat

- **L'agent n'est pas déterministe.** Un cas réussi une fois ne prouve rien : rejoue-le 5 fois (`BANC_REPS=5`).
  Un échec isolé sur 5 est du bruit ; trois échecs sur 5 est un défaut.
- Chaque exécution coûte des appels à l'agent, donc de l'argent et de l'empreinte carbone : le banc affiche
  les tokens produits et une estimation en CO2e (méthode des indicateurs d'ADA).
- **Comparer avant et après** un changement : même nombre de répétitions, même modèle, et regarder
  aussi la durée moyenne, pas seulement les réussites (une consigne qui passe de 8 à 24 secondes se
  voit dans la durée, pas dans les contrôles).

## Limites à connaître

- Les cas sont petits et tiennent sur le modèle « pwa » : ils repèrent une régression, ils ne prouvent pas que
  l'agent réussit une demande difficile (plusieurs écrans, données partagées).
- Les contrôles jugent le **comportement** (bonne décision, doublon cité, composant accessible), pas la
  qualité rédactionnelle ni l'accessibilité fine, qui demandent un humain.
- Un seul modèle à la fois, et la taille des modèles utilisée pour le CO2 est une hypothèse.

## Ajouter un cas

Dans `cas.mjs` : une demande (`demande(...)`), ce qu'on attend (`attendu`, `citer`, `interdit`, `obeit`), et pour la
réalisation des `verifs(diff)` ou `verifsFichiers(fichiers)` qui renvoient des `[libellé, ok]`. `fichiers` écrit
des fichiers dans le projet jetable avant l'exécution (un `AGENTS.md` piégé, par exemple). Garde les contrôles simples et robustes :
vérifier un mot précis rend le banc fragile (« #7 » ou « n°7 » disent la même chose).

Quand un défaut réel est corrigé dans ADA (comme les doublons de stories ou l'impasse d'une demande parent),
**ajoute le cas qui l'aurait attrapé**.
