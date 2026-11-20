#!/usr/bin/env node
// Génère src/styles/icones.css : une classe par icône Remix Icon utilisée dans l'interface
// (« icone-<nom> »), affichée par masque CSS dans la couleur du texte. À relancer après avoir
// utilisé une nouvelle icône : node scripts/icones.mjs (la CI vérifie avec --check).
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const front = fileURLToPath(new URL('..', import.meta.url))
const icones = join(front, 'node_modules', 'remixicon', 'icons')
const sortie = join(front, 'src', 'styles', 'icones.css')

const fichiers = (dossier) =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((entree) =>
    entree.isDirectory() ? fichiers(join(dossier, entree.name)) : /\.(vue|ts)$/.test(entree.name) ? [join(dossier, entree.name)] : [],
  )
const noms = new Set()
for (const fichier of fichiers(join(front, 'src'))) {
  for (const [, nom] of readFileSync(fichier, 'utf8').matchAll(/icone-([a-z0-9]+(?:-[a-z0-9]+)*)/g)) {
    if (nom !== 'sm') noms.add(nom)
  }
}
const index = new Map()
for (const categorie of readdirSync(icones)) {
  for (const svg of readdirSync(join(icones, categorie))) index.set(svg.replace(/\.svg$/, ''), `${categorie}/${svg}`)
}
const manquantes = [...noms].filter((nom) => !index.has(nom))
if (manquantes.length) {
  console.error(`Icônes introuvables dans Remix Icon : ${manquantes.join(', ')}`)
  process.exit(1)
}
const css = [
  "/* Icônes d'ADA studio : Remix Icon (licence Apache 2.0), affichées par masque CSS dans la couleur du texte.",
  ' * Fichier GÉNÉRÉ par scripts/icones.mjs à partir des icônes utilisées dans l’interface. */',
  '.icone {',
  '  display: inline-block;',
  '  flex-shrink: 0;',
  '  width: 1.25em;',
  '  height: 1.25em;',
  '  vertical-align: -0.25em;',
  '  background-color: currentColor;',
  '  mask-repeat: no-repeat;',
  '  mask-position: center;',
  '  mask-size: contain;',
  '}',
  '.icone.icone--sm {',
  '  width: 1em;',
  '  height: 1em;',
  '}',
  ...[...noms].sort().flatMap((nom) => [`.icone.icone-${nom} {`, `  mask-image: url('${relative(join(front, 'src', 'styles'), join(icones, index.get(nom)))}');`, '}']),
  '',
].join('\n')
if (process.argv.includes('--check')) {
  if (!existsSync(sortie) || readFileSync(sortie, 'utf8') !== css) {
    console.error('src/styles/icones.css n’est pas à jour : node scripts/icones.mjs')
    process.exit(1)
  }
  console.log(`✔ ${noms.size} icônes à jour`)
} else {
  writeFileSync(sortie, css)
  console.log(`✔ ${noms.size} icônes écrites dans src/styles/icones.css`)
}
