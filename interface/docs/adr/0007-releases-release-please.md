# ADR-0007 — Versions par release-please, workflow autonome

- **Statut** : Accepted
- **Date** : 2026-11-20
- **Décideurs** : ADA studio
- **Sujet** : publier les versions d'ADA studio et des projets qu'elle crée, sans dépendre d'un workflow d'organisation

## Contexte
ADA studio et chacun de ses modèles publient leurs versions avec release-please (PR de version,
notes de version, tag et release GitHub). ADA studio ne dépend d'aucun workflow partagé d'une
organisation.

## Options considérées
### Option A — Appeler directement `googleapis/release-please-action`, épinglé à une version et à son SHA
- Mêmes fichiers (`release-please-config.json`, `.release-please-manifest.json`) dans ADA studio
  et dans chaque modèle ; la PR de version est ouverte avec le jeton du dépôt (`GITHUB_TOKEN`).
### Option B — Un workflow réutilisable externe
- **Pourquoi pas** : dépendance à un dépôt tiers, et règles qui ne sont pas les nôtres.

## Décision
**Option A**, sans pré-release ni fusion automatique : la personne publie depuis le panneau
« Versions » d'ADA studio. Le workflow est identique dans ADA studio et dans chaque modèle
(`catalogue/*/`), épinglé à `v5.0.0` (`45996ed…`) ; la CI vérifie l'identité des copies.

## Conséquences
- **Positives** : aucune dépendance à une organisation ; montée de version = un changement à un
  endroit, vérifié par la CI.
- **Négatives** : la montée de version de l'action se fait à la main (épinglage au SHA).
