#!/usr/bin/env node
// Vérifie un modèle du catalogue comme le ferait son propre projet : installation des dépendances
// (npm ci ; pour Python : environnement virtuel .venv-verification et pip) dans chaque dossier
// déclaré par ada.json, puis chacun de ses contrôles (lint, types,
// tests dont accessibilité, compilation). Les chemins /app du conteneur deviennent le dossier du modèle.
// Vérifie d'abord que chaque fichier contenant un repère (__SLUG__, __NOM_PROJET__…) est listé dans
// « personnaliser » : sinon le repère resterait tel quel dans le projet créé (tests faux).
// Avec --style et --composants : la variante est appliquée à une copie du modèle (comme à la
// création d'un projet), puis vérifiée de la même façon. Storybook est construit pour tout modèle
// avec écrans (ses stories sont aussi exécutées par les tests).
// Usage : node scripts/verifier-modele.mjs <modèle> [--style <style> --composants <bibliothèque>]
import './edition.mjs' // refuse de tourner hors d'ADA studio (fichier EDITION)
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { appliquerVariantes } from './variantes.mjs'

const { positionals, values: choix } = parseArgs({ allowPositionals: true, options: { style: { type: 'string' }, composants: { type: 'string' } } })
const modele = positionals[0]
const source = resolve('catalogue', modele ?? '')
if (!modele || !existsSync(join(source, 'ada.json'))) {
  console.error(`Modèle introuvable : catalogue/${modele ?? '?'}/ada.json`)
  process.exit(1)
}
const variante = Boolean(choix.style || choix.composants)
let dossier = source
if (variante) {
  // Copie des fichiers suivis (ni node_modules ni constructions), puis application de la variante.
  dossier = mkdtempSync(join(tmpdir(), `modele-${modele}-`))
  for (const fichier of execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'], { cwd: source, encoding: 'utf8' }).split('\0').filter(Boolean)) {
    mkdirSync(dirname(join(dossier, fichier)), { recursive: true })
    copyFileSync(join(source, fichier), join(dossier, fichier))
  }
  const configuration = JSON.parse(readFileSync(join(dossier, 'ada.json'), 'utf8'))
  if (!configuration.interface?.variantes) {
    console.error(`Le modèle ${modele} n'accepte pas de variante de style ni de composants`)
    process.exit(1)
  }
  await appliquerVariantes({ projet: dossier, front: configuration.interface.dossier, style: choix.style ?? 'css-maison', composants: choix.composants ?? 'aucune' })
  console.log(`✔ Variante appliquée : ${choix.style ?? 'css-maison'} + ${choix.composants ?? 'aucune'} (${dossier})`)
}
const ada = JSON.parse(readFileSync(join(dossier, 'ada.json'), 'utf8'))
const REPERES = /__(NOM_PROJET|BASELINE|SLUG|OBJECTIF|DATE|PO)__/
const suivis = execFileSync('git', ['ls-files', '-z', '--', source], { encoding: 'utf8' }).split('\0').filter(Boolean)
const oublies = suivis
  .map((fichier) => relative(source, resolve(fichier)))
  .filter((fichier) => fichier !== 'ada.json' && !(ada.personnaliser ?? []).includes(fichier))
  .filter((fichier) => REPERES.test(readFileSync(join(source, fichier), 'utf8')))
if (oublies.length) {
  console.error(`✘ Repères non remplacés à la création : ajoutez à « personnaliser » de ada.json :\n  ${oublies.join('\n  ')}`)
  process.exit(1)
}
console.log(`✔ Fichiers à personnaliser : complets`)
const venv = join(dossier, '.venv-verification')
const env = (ada.apercu?.pip ?? []).length ? { ...process.env, VIRTUAL_ENV: venv, PATH: `${join(venv, 'bin')}:${process.env.PATH}` } : process.env
const executer = (titre, commande, cwd = dossier) => {
  console.log(`\n▶ ${titre}`)
  execFileSync('bash', ['-euo', 'pipefail', '-c', commande], { cwd, stdio: 'inherit', env })
}
if ((ada.apercu?.pip ?? []).length && !existsSync(join(venv, 'bin', 'python'))) {
  executer('environnement Python', `python3 -m venv ${JSON.stringify(venv)}`)
}
for (const sousDossier of ada.apercu?.pip ?? []) {
  const fichier = existsSync(join(dossier, sousDossier, 'requirements-dev.txt')) ? 'requirements-dev.txt' : 'requirements.txt'
  executer(`installation Python (${sousDossier})`, `pip install --quiet --disable-pip-version-check -r ${fichier}`, join(dossier, sousDossier))
}
// Une variante ajoute des dépendances : le verrou suit (npm install), comme à la création d'un projet.
const installation = variante ? 'npm install --no-audit --no-fund' : 'npm ci --no-audit --no-fund'
for (const sousDossier of ada.apercu?.npm ?? []) {
  executer(`installation (${sousDossier})`, installation, join(dossier, sousDossier))
}
for (const controle of ada.controles) {
  executer(controle, controle.replaceAll('/app', dossier))
}
if (ada.interface) executer('Storybook (construction)', 'npm run build-storybook', join(dossier, ada.interface.dossier))
console.log(`\n✔ Modèle ${modele}${variante ? ` (${choix.style ?? 'css-maison'} + ${choix.composants ?? 'aucune'})` : ''} : tous les contrôles passent`)
