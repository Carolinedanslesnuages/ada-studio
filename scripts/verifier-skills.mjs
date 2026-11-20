#!/usr/bin/env node
// Vérifie les SKILL.md de skills/<groupe>/<skill>/ selon les invariants d'agent-skills
// (IA-Generative) : name == dossier, description ≤ 1024, < 100 lignes, $ARGUMENTS en fin avec
// phrase de repli, effet de bord déclaré (disable-model-invocation + mention + agents/openai.yaml).
// Usage : node scripts/verifier-skills.mjs   (code de retour ≠ 0 si une règle est violée)
import './edition.mjs' // refuse de tourner hors d'ADA studio (fichier EDITION)
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = 'skills'
const NOM = /^[a-z0-9]+(-[a-z0-9]+)*$/
const REPLI = 'ton agent ne substitue pas les'
let erreurs = 0
const ko = (skill, msg) => { console.log(`FAIL ${skill} : ${msg}`); erreurs++ }

function frontmatter(texte) {
  const m = texte.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return null
  const champs = {}
  for (const ligne of m[1].split('\n')) {
    const c = ligne.match(/^([a-z_-]+):\s*(.*)$/)
    if (c) champs[c[1]] = c[2].replace(/^["']|["']$/g, '')
  }
  return champs
}

for (const groupe of readdirSync(RACINE, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const skill of readdirSync(join(RACINE, groupe.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dossier = join(RACINE, groupe.name, skill.name)
    const fichier = join(dossier, 'SKILL.md')
    if (!existsSync(fichier)) { ko(skill.name, 'SKILL.md absent'); continue }
    const texte = readFileSync(fichier, 'utf8')
    const fm = frontmatter(texte)
    if (!fm) { ko(skill.name, 'frontmatter YAML absent'); continue }
    const avant = erreurs
    if (fm.name !== skill.name) ko(skill.name, `name='${fm.name}', attendu '${skill.name}'`)
    if (!NOM.test(skill.name) || skill.name.length > 64) ko(skill.name, 'nom : minuscules, chiffres, tirets simples, 64 max')
    if (!skill.name.startsWith(`${groupe.name}-`)) ko(skill.name, `préfixe de famille '${groupe.name}-' attendu`)
    if (!fm.description) ko(skill.name, 'description absente')
    else if (fm.description.length > 1024) ko(skill.name, `description de ${fm.description.length} caractères (> 1024)`)
    const lignes = texte.split('\n').length
    if (lignes > 100) ko(skill.name, `${lignes} lignes (> 100) : sortir des parties dans references/`)
    const occurrences = texte.split('$ARGUMENTS').length - 1
    if (occurrences > 1) ko(skill.name, `$ARGUMENTS écrit ${occurrences} fois (1 seule, en fin de fichier)`)
    if (occurrences === 1 && !texte.includes(REPLI)) ko(skill.name, '$ARGUMENTS sans la phrase de repli pour les autres agents')
    if (fm['disable-model-invocation'] === 'true') {
      if (!/uniquement sur demande explicite/i.test(fm.description ?? '')) ko(skill.name, "effet de bord : dire « uniquement sur demande explicite » dans la description")
      if (!existsSync(join(dossier, 'agents', 'openai.yaml'))) ko(skill.name, 'effet de bord : agents/openai.yaml manquant (Codex)')
    }
    if (erreurs === avant) console.log(`OK   ${skill.name} (${lignes} lignes)`)
  }
}
process.exit(erreurs ? 1 : 0)
