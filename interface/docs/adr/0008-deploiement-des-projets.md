# ADR-0008 — Déploiement des projets : image Docker toujours, chart Helm sur demande

- **Statut** : Accepted
- **Date** : 2026-11-16
- **Décideurs** : équipe ADA
- **Sujet** : de quoi déployer les projets créés par ADA (issue #12)

## Contexte
Un POC n'est pas toujours mis en ligne, mais quand il l'est, il faut une image et un chart Helm.
Un chart peut être rangé avec le code ou dans un dépôt séparé (`-infra`), selon l'hébergeur.

## Options considérées
### A — Un dossier `charts/` dans le projet
- Tout au même endroit ; simple pour un PO qui ne code pas.
### B — Un dépôt `<projet>-infra` créé par ADA
- Conforme à l'usage d'IA-Generative ; **pourquoi pas maintenant** : deux dépôts à gérer pour un POC.
### C — Rien par défaut, une question à la création
- Le chart n'arrive que si le PO prévoit de déployer.

## Décision
**C avec A.**
- **Image Docker dans tous les modèles déployables** (aujourd'hui `vue-node` et `formulaire`) :
  l'API sert aussi le front construit, une seule image, utilisateur non privilégié, contrat
  `/__version__`. La CI du projet la construit et vérifie qu'elle démarre, à chaque demande.
- **Question « Ce projet sera-t-il déployé ? »** à la création, pour ces modèles seulement
  (`deploiement.chart` dans `ada.json`). Oui : `charts/app` est ajouté, personnalisé, vérifié par
  `helm lint --strict` et `helm template` en CI.
- **Chart générique** : une instance (base SQLite), stratégie `Recreate`, volume persistant conservé
  (`helm.sh/resource-policy: keep`), conteneur non root en lecture seule, sondes sur `/api`,
  ingress optionnel ; `values.schema.json` refuse un ingress sans adresse.
- **Chart protégé** comme `.github/` : l'assistant ne peut ni le modifier ni l'écrire
  (`--disallowedTools`), et la consigne le dit.

## Conséquences
- **Positives** : un projet déployé est prêt à être hébergé, vérifié à chaque story ; un POC qui
  ne l'est pas reste simple.
- **Négatives** : un contrôle de CI de plus (construction de l'image).
- **Encore ouvert** :
  - hébergeur et registre (ghcr.io par exemple) : `image.repository` est à fournir par l'hébergeur ;
  - publication de l'image et du chart (workflows à écrire) ;
  - `vue-nest` (API NestJS + PostgreSQL : base externe à brancher par secret) ;
  - passage à l'option B si l'hébergeur impose des dépôts `-infra`.
