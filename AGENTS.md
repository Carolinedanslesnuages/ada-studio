ADA studio (fichier EDITION = studio). Ce n'est pas l'ADA de `~/atelier-po`, ne la modifie jamais.

# Instructions pour un agent travaillant dans ADA studio

Ce fichier est lu par Codex, OpenCode, Cursor, Copilot, Gemini CLI… ; `CLAUDE.md` l'importe
pour Claude Code. **Une seule source : c'est ici qu'on écrit.**

## Pour qui tu travailles

ADA studio est utilisée par des personnes qui ne codent pas (appelées « PO » dans le code). Elles
produisent des POC en autonomie ; un développeur n'intervient qu'en dernier recours.

- Toujours en français, en langage métier. Pas de jargon sans explication.
- Phrases courtes, une question à la fois.
- Ne jamais inventer une règle métier : si c'est flou, demander.
- Un échec technique : le dire simplement, proposer l'aide d'un développeur. Ne pas le masquer.

## Structure

```
skills/<groupe>/<skill>/SKILL.md   une skill = un dossier ; le nom du DOSSIER est le nom de la skill
skills/<groupe>/index.json         catalogue GÉNÉRÉ : node scripts/skills-index.mjs
.claude/skills/<skill>             lien vers skills/po/<skill> (Claude Code)
.agents/skills/<skill>             lien vers skills/po/<skill> (Codex, OpenCode, Cursor, Copilot, Gemini CLI)
scripts/                           vérification des skills, des modèles et génération des catalogues
catalogue/<modele>/                modèles de projet (copiés à la création d'un projet, décrits par ada.json)
variantes/                         style et bibliothèque de composants choisis à la création (combinaisons.json)
projets/                           projets des PO (un dépôt git chacun, hors de ce dépôt)
interface/                         interface web PO (API NestJS, front Vue ; même dépôt)
docs/                              documentation (sources externes, licences des dépendances)
EDITION                            « studio » : sans lui, l'API et les scripts refusent de démarrer
```

## Skills

| Skill | Rôle |
|---|---|
| `po-projet-nouveau` | Nom → objectif → stack → style et bibliothèque → squelette testé, Storybook, CI, anti-fuite, release-please, ADR |
| `po-story` | Story complète et courte → plan validé → tests d'abord, une story Storybook par nouveau composant → RGAA → périmètre → fiche |
| `po-bug` | Constat → hypothèses → test rouge → correction minimale → fiche |

## Règles absolues

- Ne travailler que dans le dossier du projet concerné.
- Une branche par story ou par bug ; **jamais de fusion par l'agent** : le PO fusionne, CI verte.
- Aucune donnée réelle, aucun secret dans un projet. `--no-verify` interdit.
- Seules les stacks de `skills/po/po-projet-nouveau/references/stacks/` sont autorisées.
- Vérifier sur les **codes de retour** des commandes, jamais sur un extrait filtré de la sortie.
- **Aucune identité de l'État**, nulle part : ni dans l'interface, ni dans les modèles, ni dans les
  projets créés. Ne jamais imiter l'apparence d'un site officiel de l'État (Marianne, bleu France, bloc-marque, nom de domaine gouv.fr).
- **Licence** : ADA studio est propriétaire, tous droits réservés (`LICENSE`). Ne jamais la présenter
  comme libre ou open source ; tout `package.json` garde `"license": "UNLICENSED"` et `"private": true`.
  Les projets créés n'ont aucune licence par défaut.
- **Un fichier, une responsabilité**, dans ADA studio comme dans chaque projet qu'elle crée ou reprend :
  au plus 400 lignes non vides par fichier de code, 600 par test (`.github/workflows/taille-fichiers.yml`,
  identique partout). Découper par responsabilité, jamais une fonction par fichier.

## Invariants des skills (format ouvert Agent Skills)

1. `name:` identique au nom du dossier, préfixe de famille `po-`.
2. `description` ≤ 1024 caractères, qui dit seule quoi et quand (seul champ lu par tous les agents).
3. Moins de 100 lignes par `SKILL.md` ; le reste dans `references/`.
4. `$ARGUMENTS` une seule fois, en dernière ligne, suivi de la phrase de repli.
5. Effet de bord → `disable-model-invocation: true`, « uniquement sur demande explicite » dans
   la description, et `agents/openai.yaml` (`allow_implicit_invocation: false`) pour Codex.
6. Neutre vis-à-vis de l'agent : nommer l'intention avant l'outil.

## Avant de proposer un changement

```bash
node scripts/verifier-skills.mjs        # invariants des SKILL.md
node scripts/skills-index.mjs --check   # catalogues à jour (sans --check pour régénérer)
node scripts/verifier-modele.mjs <id>   # un modèle de catalogue/ passe tous ses contrôles
node scripts/verifier-modele.mjs <id> --style <style> --composants <bibliothèque>   # une variante
node --test scripts/variantes.test.mjs  # application des variantes, combinaisons interdites refusées
```
Si tu changes une **consigne de l'agent, le modèle ou une skill**, rejoue le banc d'essai (il coûte des
appels à l'agent : pas dans la CI) : `scripts/banc-agent/README.md`.

Livraison : branche dédiée, PR, messages Conventional Commits (release-please).
