# ADR-0009 — Les échanges avec l'assistant sont enregistrés dans GitHub

- **Statut** : Accepted — remplacé en partie par l'[ADR-0011](0011-etat-des-demandes-dans-ada.md) (la conversation et le statut vivent dans ADA)
- **Date** : 2026-11-16
- **Décideurs** : responsable d'ADA
- **Sujet** : où garder les prompts du mode libre, les questions de l'assistant, les réponses du
  PO et la validation du plan

## Contexte
L'ADR-0001 fait des issues GitHub la source de vérité des stories. Restait à décider où vivent
les **échanges** : le prompt du mode libre, les questions de l'assistant, les réponses du PO, la
demande de modification et l'accord sur le plan. On aurait pu les garder dans ADA seulement,
plus discrets. Le choix inverse a été fait, délibérément.

## Options considérées
### Option A — Tout dans l'issue : un prompt devient une issue « mode-libre », chaque échange un commentaire
- Au nom du PO connecté (jeton de la GitHub App), visible par l'équipe du projet.
### Option B — Échanges gardés dans ADA (base ou fichiers)
- **Pourquoi pas** : un second historique, invisible des développeurs, perdu si ADA change.

## Décision
**Option A.** Raisons, par ordre d'importance :

1. **Traçabilité des décisions.** Du code est écrit par une IA : on doit
   pouvoir dire qui a demandé quoi, qui a validé quel plan, quand, et sur quelle réponse. L'issue
   relie la demande, l'échange, le plan validé, la pull request (`Closes #n`) et la version.
2. **L'assistant s'appuie dessus.** À chaque reprise (réponse, relance, redémarrage), il relit tout
   l'échange depuis l'issue : rien ne se perd, et ce que l'assistant a lu est ce que l'équipe voit.
3. **Un développeur peut reprendre sans ADA.** Quand une demande est bloquée, tout le contexte est
   dans l'issue qui lui est assignée.
4. **Une seule source de vérité, pas de base à administrer** (ADR-0001), et un historique qui
   survit à ADA : si l'outil change ou disparaît, les échanges restent dans le projet.
5. **Pas de demande hors trace.** Même un petit changement en mode libre a son issue : chaque
   modification du code se rattache à une demande écrite.

## Conséquences
- **Le PO est prévenu** avant chaque écriture en son nom (lancement, réponse, validation du plan,
  prompt), et ADA explique pourquoi (« Pourquoi sur GitHub ? » dans le suivi d'une demande).
- **Rien de confidentiel dans les échanges** : ils sont conservés et visibles par l'équipe, comme le
  reste du projet (règle déjà posée : aucune donnée réelle, aucun secret).
- Le PO peut modifier ou supprimer un de ses commentaires sur GitHub ; l'assistant en tient compte
  à sa prochaine lecture.
- Les commentaires de l'assistant portent un marqueur invisible (`<!-- ada-studio:assistant -->`)
  pour être distingués de ceux du PO.
