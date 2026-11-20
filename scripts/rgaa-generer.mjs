#!/usr/bin/env node
// Génère le référentiel RGAA en Markdown (index + un fichier par thème) à partir du fichier
// officiel criteres.json publié par la DINUM (dépôt DISIC/accessibilite.numerique.gouv.fr).
// Contenus sous licence ouverte 2.0 — source : https://accessibilite.numerique.gouv.fr
// Usage : node scripts/rgaa-generer.mjs <criteres.json> <dossier de sortie> <version>
import './edition.mjs' // refuse de tourner hors d'ADA studio (fichier EDITION)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [, , source, sortie, version] = process.argv
if (!source || !sortie || !version) {
  console.error('Usage : node scripts/rgaa-generer.mjs <criteres.json> <dossier de sortie> <version>')
  process.exit(1)
}
const SITE = 'https://accessibilite.numerique.gouv.fr'
const referentiel = JSON.parse(readFileSync(source, 'utf8'))

// Liens internes du glossaire « [terme](#ancre) » → « terme » (le texte garde tout son sens).
const nettoyer = (texte) => String(texte ?? '').replace(/\[([^\]]+)\]\(#[^)]+\)/g, '$1').trim()
const slug = (texte) =>
  texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const liste = (valeur) => (Array.isArray(valeur) ? valeur : valeur ? [valeur] : []).map(nettoyer).filter(Boolean)

const ENTETE = `> Référentiel général d’amélioration de l’accessibilité (RGAA) ${version}, publié par la DINUM.
> Source officielle : ${SITE} — contenus sous licence ouverte 2.0. Généré par \`scripts/rgaa-generer.mjs\`
> à partir de \`criteres.json\` : ne pas modifier à la main. Les termes du référentiel sont définis
> dans le glossaire officiel (${SITE}/methode/glossaire/).`

mkdirSync(sortie, { recursive: true })
const index = [`# RGAA ${version} — les 106 critères`, '', ENTETE, '']
index.push(
  'Pour chaque écran ou composant touché, ouvrir le fichier du thème concerné : il contient les tests',
  'de chaque critère et ses références WCAG. Tous les critères du RGAA sont à respecter.',
  '',
)
let total = 0
for (const theme of referentiel.topics) {
  const fichier = `${String(theme.number).padStart(2, '0')}-${slug(theme.topic)}.md`
  const contenu = [`# Thème ${theme.number} — ${theme.topic}`, '', ENTETE, '']
  index.push(`## ${theme.number}. ${theme.topic} — [détail](${fichier})`, '')
  for (const { criterium } of theme.criteria) {
    total++
    const numero = `${theme.number}.${criterium.number}`
    const titre = nettoyer(criterium.title)
    index.push(`- **${numero}** ${titre}`)
    contenu.push(`## Critère ${numero}`, '', titre, '', '**Tests**', '')
    for (const [numeroTest, lignes] of Object.entries(criterium.tests)) {
      const [premiere, ...suite] = liste(lignes)
      contenu.push(`- **${numero}.${numeroTest}** ${premiere ?? ''}`)
      for (const ligne of suite) contenu.push(`  - ${ligne}`)
    }
    const casParticuliers = liste(criterium.particularCases)
    if (casParticuliers.length) contenu.push('', '**Cas particuliers**', '', ...casParticuliers.map((ligne) => `- ${ligne}`))
    const notes = liste(criterium.technicalNote)
    if (notes.length) contenu.push('', '**Notes techniques**', '', ...notes.map((ligne) => `- ${ligne}`))
    const wcag = (criterium.references ?? []).flatMap((reference) => reference.wcag ?? [])
    if (wcag.length) contenu.push('', `**WCAG** : ${wcag.join(' ; ')}`)
    contenu.push(`**Fiche officielle** : ${SITE}/methode/criteres-et-tests/#${numero}`, '')
  }
  index.push('')
  writeFileSync(join(sortie, fichier), `${contenu.join('\n').trim()}\n`)
}
writeFileSync(join(sortie, 'README.md'), `${index.join('\n').trim()}\n`)
console.log(`${total} critères écrits dans ${sortie}`)
