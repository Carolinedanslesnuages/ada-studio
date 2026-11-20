# ADR-0012 — Un fichier, une responsabilité, vérifié en CI dans ADA et dans chaque projet

- **Statut** : Accepted
- **Date** : 2026-11-19
- **Décideurs** : responsable d'ADA
- **Sujet** : taille et découpage des fichiers de code, dans ADA et dans les projets qu'elle crée ou reprend

## Contexte
Le code d'ADA et celui des projets est écrit en grande partie par des agents. Rien ne limitait la
taille d'un fichier : `agent.service.ts` atteignait 1 100 lignes et mêlait verrou, file d'attente,
lancement de l'agent, conseil de stack et les quatre phases. Un fichier qui mélange plusieurs
responsabilités se relit mal, se teste mal, et un agent qui le modifie en charge tout le contenu
pour un changement local.

## Décision
- **Une responsabilité par fichier** : un fichier fait une seule chose, que dit son nom. Pas une
  fonction par fichier : quelques fonctions qui vont ensemble restent ensemble.
- **Seuils** : 400 lignes non vides par fichier de code, 600 par fichier de test (les tests sont
  plus répétitifs). Exclus : migrations, `*.d.ts`, fichiers minifiés.
- **Contrôle en CI** `.github/workflows/taille-fichiers.yml`, identique dans ADA et dans chaque
  modèle (vérifié par `check.yml`), indépendant du langage. Il juge les fichiers ajoutés ou
  modifiés par la PR ; **un fichier déjà trop long est toléré tant qu'il ne grossit pas**
  (projet repris) : on le découpe quand on y travaille.
- Contrôle **exigé avant fusion** (« Taille des fichiers (une responsabilité par fichier) ») dans
  `ada.json` de chaque modèle, et dans celui qu'ADA écrit pour un projet repris ; la PR de reprise
  apporte le workflow. La consigne de l'agent (réalisation, conversation) porte la règle, et
  autorise à sortir dans un nouveau fichier la partie qu'il modifie d'un fichier trop long.
- **Pas d'architecture en couches** (« Clean Architecture », ports et adaptateurs partout), ni
  SOLID appliqué à la lettre : ADA n'a ni base de données ni équipe nombreuse, et ces couches
  doubleraient fichiers et détours pour peu de protection. Seuls les points de contact avec
  l'extérieur (agent lancé, commandes système, GitHub) sont injectés, pour les tests et pour
  pouvoir changer d'agent.

## Conséquences
- ADA découpée sans changement de comportement (mêmes tests) : `api/src/agent/` (ordonnanceur,
  verrou, file d'attente, journal, une phase par fichier, outils communs, consignes, lecture des
  réponses), `projets/protection-main.ts`, `projets/reglages-depot.ts`, `projets/creation-depot.ts`,
  `stories/resume-story.ts`,
  `stories/droits-auteur.ts`, `stories/decoupage.ts`, deux composants sortis de `FilStory.vue`.
- Les services restent les points d'entrée (contrôleurs, travailleur) et délèguent à de petites
  classes qu'ils construisent eux-mêmes : l'injection de dépendances Nest n'a pas changé.
- Un projet déjà créé n'a pas le contrôle : il l'obtient en copiant le workflow et en l'ajoutant
  à `controlesRequis` (et à la règle de protection de `main`).
