#!/usr/bin/env node
// Inventaire des licences des dépendances d'ADA studio (interface) et des projets qu'elle crée
// (modèles du catalogue, bibliothèques des variantes). Signale toute licence qui imposerait de
// publier le code (GPL, AGPL, LGPL, SSPL, EUPL…) ou inconnue. Écrit docs/licences-dependances.md.
// Usage : node scripts/licences.mjs [--check]   (--check : échoue si une licence à risque apparaît)
import './edition.mjs' // refuse de tourner hors d'ADA studio (fichier EDITION)
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Copyleft fort : imposerait de publier le code. Une double licence avec une option permissive (« OR ») n'en est pas. */
const COPYLEFT_FORT = /\b(A?GPL|LGPL|SSPL|EUPL|OSL|CC-BY-SA)/i
/** Copyleft faible, au niveau du fichier : n'oblige qu'à publier les fichiers de la bibliothèque si on les modifie. */
const COPYLEFT_FAIBLE = /\b(MPL|EPL)/i
const permissifEnOption = (licence) => /\bOR\b/i.test(licence) && /(MIT|BSD|Apache|ISC)/i.test(licence)
const aRisqueLicence = (licence) => licence === 'inconnue' || (COPYLEFT_FORT.test(licence) && !permissifEnOption(licence))
const verrous = execFileSync('git', ['ls-files', '*package-lock.json'], { encoding: 'utf8' }).split('\n').filter(Boolean)

/** Licence absente du verrou : lue sur npm (une seule fois par paquet). */
const cacheNpm = new Map()
function licenceNpm(nom, version) {
  const cle = `${nom}@${version}`
  if (!cacheNpm.has(cle)) {
    let licence = ''
    try {
      licence = execFileSync('npm', ['view', cle, 'license'], { encoding: 'utf8' }).trim()
      // Ancien format de package.json : « licenses: [{ type }] ».
      if (!licence) licence = JSON.parse(execFileSync('npm', ['view', cle, 'licenses', '--json'], { encoding: 'utf8' }) || '[]').map((entree) => entree.type).join(' OR ')
    } catch {
      licence = ''
    }
    cacheNpm.set(cle, licence || 'inconnue')
  }
  return cacheNpm.get(cle)
}

/** Licences d'un fichier de verrouillage : nom@version → licence. */
function licencesDe(verrou) {
  const { packages = {} } = JSON.parse(readFileSync(verrou, 'utf8'))
  const resultat = new Map()
  for (const [chemin, paquet] of Object.entries(packages)) {
    if (!chemin) continue
    const nom = chemin.slice(chemin.lastIndexOf('node_modules/') + 'node_modules/'.length)
    resultat.set(`${nom}@${paquet.version}`, paquet.license ?? licenceNpm(nom, paquet.version))
  }
  return resultat
}

const parPartie = []
const toutes = new Map()
for (const verrou of verrous) {
  const licences = licencesDe(verrou)
  parPartie.push({ partie: verrou.replace(/\/?package-lock\.json$/, '') || '.', licences })
  for (const [paquet, licence] of licences) toutes.set(paquet, licence)
}

// Bibliothèques ajoutées par les variantes (pas encore dans un verrou) : licence lue sur npm.
const variantes = new Map()
for (const axe of ['style', 'composants']) {
  for (const valeur of readdirSync(join('variantes', axe))) {
    for (const fichier of [join('variantes', axe, valeur, 'variante.json'), ...readdirSync(join('variantes', axe, valeur)).filter((nom) => nom.startsWith('avec-')).map((nom) => join('variantes', axe, valeur, nom, 'variante.json'))]) {
      let variante
      try { variante = JSON.parse(readFileSync(fichier, 'utf8')) } catch { continue }
      for (const [nom, version] of Object.entries({ ...variante.dependencies, ...variante.devDependencies })) {
        const licence = execFileSync('npm', ['view', `${nom}@${version}`, 'license'], { encoding: 'utf8' }).trim() || 'inconnue'
        variantes.set(`${nom}@${version}`, { licence, variante: `${axe}/${valeur}` })
      }
    }
  }
}

const compter = (licences) => {
  const total = new Map()
  for (const licence of licences) total.set(licence, (total.get(licence) ?? 0) + 1)
  return [...total].sort((a, b) => b[1] - a[1])
}
const aRisque = [...toutes].filter(([, licence]) => aRisqueLicence(licence))
const faibles = [...toutes].filter(([, licence]) => COPYLEFT_FAIBLE.test(licence) && !permissifEnOption(licence))
const variantesARisque = [...variantes].filter(([, { licence }]) => aRisqueLicence(licence))

const lignes = [
  '# Licences des dépendances',
  '',
  'Fichier GÉNÉRÉ par `node scripts/licences.mjs`. ADA studio est propriétaire (voir `LICENSE`) ;',
  'ses dépendances gardent leurs propres licences, toutes permissives : aucune n’impose de publier le code.',
  '',
  '## Toutes parties confondues',
  '',
  `${toutes.size} paquets distincts (interface d’ADA studio et modèles du catalogue).`,
  '',
  '| Licence | Paquets |',
  '|---|---|',
  ...compter(toutes.values()).map(([licence, nombre]) => `| ${licence} | ${nombre} |`),
  '',
  '## Licences à surveiller',
  '',
  aRisque.length ? 'Paquets dont la licence imposerait de publier le code, ou inconnue :' : '**Aucune licence GPL, AGPL, LGPL, SSPL ni EUPL ; aucune licence inconnue.** Les doubles licences qui offrent une option permissive (ex. « BSD-3-Clause OR GPL-2.0 ») sont utilisées sous l’option permissive.',
  ...aRisque.map(([paquet, licence]) => `- \`${paquet}\` : ${licence}`),
  '',
  'Copyleft faible, au niveau du fichier (n’oblige qu’à publier les fichiers de ces bibliothèques si on les modifie ; ADA studio ne les modifie pas) :',
  ...faibles.map(([paquet, licence]) => `- \`${paquet}\` : ${licence}`),
  '',
  '## Bibliothèques proposées à la création (variantes)',
  '',
  '| Paquet | Licence | Variante |',
  '|---|---|---|',
  ...[...variantes].map(([paquet, { licence, variante }]) => `| \`${paquet}\` | ${licence} | ${variante} |`),
  '',
  '## Par partie',
  '',
  ...parPartie.flatMap(({ partie, licences }) => [`- \`${partie}\` : ${compter(licences.values()).map(([licence, nombre]) => `${licence} (${nombre})`).join(', ')}`]),
  '',
]
writeFileSync('docs/licences-dependances.md', lignes.join('\n'))
console.log(`✔ ${toutes.size} paquets, ${variantes.size} bibliothèques de variantes ; à surveiller : ${aRisque.length + variantesARisque.length}`)
if (process.argv.includes('--check') && aRisque.length + variantesARisque.length) {
  for (const [paquet, licence] of aRisque) console.error(`✘ ${paquet} : ${licence}`)
  process.exit(1)
}
