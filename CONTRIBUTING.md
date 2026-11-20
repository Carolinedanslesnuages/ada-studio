# Contribuer

| Vous avez… | Faites |
|---|---|
| essayé une skill avec un autre agent que Claude Code | une issue : agent, version, skill, ce qui a marché ou non |
| vu l'assistant mal se comporter avec un PO | une issue, avec la demande exacte du PO et la réponse obtenue |
| éprouvé une stack non encore validée (toutes sauf vue-nest) | une PR qui corrige la fiche de stack et la marque « vérifiée » dans `references/stacks/README.md` |
| un correctif ou une nouvelle skill | une PR |

## Proposer une PR

1. Branche dédiée, jamais de commit sur `main`.
2. Respecter les invariants de [`AGENTS.md`](AGENTS.md).
3. `node scripts/verifier-skills.mjs` et `node scripts/skills-index.mjs --check` passent (la CI les rejoue).
4. Messages Conventional Commits (`feat:`, `fix:`, `docs:`…) : release-please en dépend.
5. Dire avec quel(s) agent(s) le changement a été testé.

## Ajouter une stack

1. Copier `skills/po/po-projet-nouveau/references/stacks/vue-nest.md` et garder les mêmes
   sections : Quand la choisir, Structure, Initialisation, Conventions, Commandes, CI, Version,
   .gitignore, Interface.
2. Ajouter la ligne au menu de `references/stacks/README.md`.
3. Générer un projet de bout en bout, faire passer sa CI sur un clone neuf, puis seulement
   la marquer « vérifiée ».

## Verser l'atelier dans agent-skills

Copier `skills/po/` dans `skills/po/` d'agent-skills, régénérer les catalogues
(`node scripts/skills-index.mjs`), et remplacer dans les skills les méthodes « résumées »
(`docs/sources-externes.md`) par un appel direct aux skills d'origine.
