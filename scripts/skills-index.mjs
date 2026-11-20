#!/usr/bin/env node
// Génère (ou vérifie avec --check) skills/<groupe>/index.json, au format des catalogues
// d'agent-skills : { "skills": [ { "name", "files": ["SKILL.md", ...] } ] }.
import './edition.mjs' // refuse de tourner hors d'ADA studio (fichier EDITION)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const fichiers = (dossier, racine = dossier) =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(join(dossier, e.name), racine) : [relative(racine, join(dossier, e.name))],
  )

const index = (groupe) => ({
  skills: readdirSync(groupe, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(groupe, e.name, 'SKILL.md')))
    .map((e) => {
      const liste = fichiers(join(groupe, e.name)).sort()
      return { name: e.name, files: ['SKILL.md', ...liste.filter((f) => f !== 'SKILL.md')] }
    })
    .sort((a, b) => a.name.localeCompare(b.name)),
})

const verifier = process.argv.includes('--check')
let ok = true
for (const g of readdirSync('skills', { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const groupe = join('skills', g.name)
  const attendu = `${JSON.stringify(index(groupe), null, 2)}\n`
  const chemin = join(groupe, 'index.json')
  if (verifier) {
    const aJour = existsSync(chemin) && readFileSync(chemin, 'utf8') === attendu
    console.log(`${aJour ? 'OK  ' : 'FAIL'} ${chemin}`)
    ok &&= aJour
  } else {
    writeFileSync(chemin, attendu)
    console.log(`écrit ${chemin}`)
  }
}
process.exit(ok ? 0 : 1)
