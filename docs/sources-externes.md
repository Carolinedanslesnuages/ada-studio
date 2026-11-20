# Sources externes reprises ou citées

| Élément d'ADA studio | Source | Nature |
|---|---|---|
| Hook `destructive-guard` (`.claude/settings.json`) | [IA-Generative/agent-skills](https://github.com/IA-Generative/agent-skills), `hooks/destructive-guard.md` | Repris tel quel (extrait automatiquement du fichier source) |
| `.gitignore` durci, `private/`, pre-commit gitleaks (`po-projet-nouveau/references/securite.md`) | agent-skills, skill `repo-init` | Adapté |
| Contrôle de périmètre (`po-story/references/perimetre.md`) | agent-skills, skill `repo-perimetre` | Méthode résumée ; la skill d'origine est appelée si elle est installée |
| Méthode hypothèses + test rouge (`po-bug`) | agent-skills, skill `bug-investigate` | Méthode résumée ; la skill d'origine est appelée si elle est installée |
| Format ADR (`po-projet-nouveau/references/socle.md`) | agent-skills, skill `adr-new` | Modèle repris |
| Contrat `GET /__version__` | agent-skills, skill `repo-version-json` (ADR-0004 MirAI, format Dockerflow) | Contrat repris ; la production du `version.json` reste à `repo-version-json --setup` |
| Invariants des skills, `agents/openai.yaml`, catalogues `index.json` | agent-skills, `AGENTS.md` et `scripts/skills-index.mjs` | Conventions reprises, scripts réécrits |
| release-please | [googleapis/release-please-action](https://github.com/googleapis/release-please-action) v5.0.0 | Action épinglée |
| gitleaks | [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) v8.30.1 | Binaire épinglé, empreinte vérifiée |
| axe-core | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | Bibliothèque de test d'accessibilité |
| Référentiel RGAA 4.1.2 (`skills/po/po-story/references/rgaa-4.1.2/`, `ressources/rgaa/`) | DINUM, [accessibilite.numerique.gouv.fr](https://accessibilite.numerique.gouv.fr), fichier `RGAA/criteres.json` du dépôt [DISIC/accessibilite.numerique.gouv.fr](https://github.com/DISIC/accessibilite.numerique.gouv.fr) | Licence ouverte 2.0 ; Markdown généré par `scripts/rgaa-generer.mjs`, source citée en tête de chaque fichier |
| Skills `bug-investigate`, `repo-perimetre`, `controle-qualite-code` (reliées au projet pour l'assistant d'ADA, non copiées ; `adr-new` est écartée, voir `interface/README.md`) | [IA-Generative/agent-skills](https://github.com/IA-Generative/agent-skills) | Reliées depuis le clone local, à jour par `git pull` |

Si ADA studio est versée dans agent-skills, les éléments « résumés » doivent céder la place à un
appel direct des skills d'origine, déjà présentes dans ce dépôt.

Licences des dépendances d'ADA studio et des bibliothèques proposées aux projets :
[licences-dependances.md](licences-dependances.md).
