#!/usr/bin/env node
// Applique à un projet le style puis la bibliothèque de composants choisis à sa création.
// Base de chaque modèle avec front : « css-maison » + « aucune ». Chaque autre choix est une
// variante (variantes/<axe>/<valeur>/) : des fichiers qui remplacent ou complètent la base, des
// dépendances à ajouter, des fichiers à retirer. Une bibliothèque peut compléter un style précis
// (sous-dossier avec-<style>/). Une combinaison interdite est refusée, avec sa raison.
// Usage : node scripts/variantes.mjs <dossier du projet> <dossier du front> <style> <composants>
import './edition.mjs' // refuse de tourner hors d'ADA studio (fichier EDITION)
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DOSSIER_VARIANTES = resolve(fileURLToPath(new URL('../variantes', import.meta.url)))
const DEBUT = '<!-- ada:interface:debut -->'
const FIN = '<!-- ada:interface:fin -->'

/** Styles, bibliothèques, valeurs par défaut et combinaisons interdites (une seule source). */
export function lireCombinaisons(dossier = DOSSIER_VARIANTES) {
  return JSON.parse(readFileSync(join(dossier, 'combinaisons.json'), 'utf8'))
}

/** { ok: true } ou { ok: false, raison } : valeurs connues et combinaison autorisée. */
export function verifierCombinaison(style, composants, combinaisons = lireCombinaisons()) {
  if (!combinaisons.styles.some((option) => option.valeur === style)) return { ok: false, raison: `Style inconnu : « ${style} ».` }
  if (!combinaisons.composants.some((option) => option.valeur === composants)) {
    return { ok: false, raison: `Bibliothèque de composants inconnue : « ${composants} ».` }
  }
  const interdite = combinaisons.interdites.find((regle) => regle.style === style && regle.composants === composants)
  return interdite ? { ok: false, raison: interdite.raison } : { ok: true }
}

async function lireJson(chemin, parDefaut) {
  return existsSync(chemin) ? JSON.parse(await readFile(chemin, 'utf8')) : parDefaut
}

const trier = (objet) => Object.fromEntries(Object.entries(objet).sort(([a], [b]) => a.localeCompare(b)))

/** Copie les fichiers d'une variante, ajoute ses dépendances, retire ce qu'elle remplace. */
async function appliquerUne(dossierVariante, front) {
  const variante = await lireJson(join(dossierVariante, 'variante.json'), {})
  for (const fichier of variante.supprimer ?? []) await rm(join(front, fichier), { recursive: true, force: true })
  if (existsSync(join(dossierVariante, 'fichiers'))) await cp(join(dossierVariante, 'fichiers'), front, { recursive: true, force: true })
  const cheminPaquet = join(front, 'package.json')
  const paquet = JSON.parse(await readFile(cheminPaquet, 'utf8'))
  for (const section of ['dependencies', 'devDependencies']) {
    if (variante[section]) paquet[section] = trier({ ...(paquet[section] ?? {}), ...variante[section] })
  }
  await writeFile(cheminPaquet, `${JSON.stringify(paquet, null, 2)}\n`)
  return variante
}

/** Section « Interface » d'AGENTS.md, générée selon les choix. */
export function sectionInterface(style, composants, regles, combinaisons = lireCombinaisons()) {
  const optionStyle = combinaisons.styles.find((option) => option.valeur === style)
  const optionComposants = combinaisons.composants.find((option) => option.valeur === composants)
  const bibliotheque = composants === 'aucune' ? 'du projet (src/components/ui/)' : `de ${optionComposants.nom}`
  return [
    DEBUT,
    '## Interface',
    '',
    `- Style : **${optionStyle.nom}** (${optionStyle.doc}). Bibliothèque de composants : **${optionComposants.nom}** (${optionComposants.doc}).`,
    `- Utilise d'abord les composants ${bibliotheque} ; n'installe aucune autre bibliothèque de composants ni de style.`,
    ...regles.map((regle) => `- ${regle}`),
    "- Couleurs, police et rayons : jetons `--app-*` (src/styles/jetons.css). Nouvelle couleur : contraste d'au moins 4,5:1 sur son fond.",
    "- Ne jamais imiter l'apparence d'un site officiel de l'État (Marianne, bleu France, bloc-marque, nom de domaine gouv.fr).",
    '- **Tout nouveau composant réutilisable arrive avec sa story** (`Nom.stories.ts` à côté de lui) qui montre ses états :',
    '  normal, focus, désactivé, erreur, vide, chargement. Les stories sont aussi des tests (rendu et accessibilité) :',
    '  une story manquante bloque la livraison comme un test manquant. `npm run storybook` pour les voir.',
    FIN,
  ].join('\n')
}

function remplacerSection(texte, section) {
  const debut = texte.indexOf(DEBUT)
  const fin = texte.indexOf(FIN)
  if (debut === -1 || fin === -1) return `${texte.trimEnd()}\n\n${section}\n`
  return texte.slice(0, debut) + section + texte.slice(fin + FIN.length)
}

/** Paragraphe de l'ADR-0001 : options retenues et options considérées. */
function sectionAdr(style, composants, combinaisons) {
  const nom = (liste, valeur) => liste.find((option) => option.valeur === valeur).nom
  const autres = (liste, valeur) => liste.filter((option) => option.valeur !== valeur).map((option) => option.nom).join(', ')
  return [
    DEBUT,
    '## Interface',
    `- **Style retenu** : ${nom(combinaisons.styles, style)}. Options considérées : ${autres(combinaisons.styles, style)}.`,
    `- **Bibliothèque de composants retenue** : ${nom(combinaisons.composants, composants)}. Options considérées : ${autres(combinaisons.composants, composants)}.`,
    '- Toutes les options proposées sont gratuites, sous licence MIT et compatibles Vue 3.',
    FIN,
  ].join('\n')
}

/**
 * Applique style puis composants au front du projet, et l'écrit dans ada.json (« edition »,
 * « style », « composants »), dans AGENTS.md (section Interface) et dans l'ADR-0001.
 */
export async function appliquerVariantes({ projet, front = '.', style, composants, dossier = DOSSIER_VARIANTES }) {
  const combinaisons = lireCombinaisons(dossier)
  const verdict = verifierCombinaison(style, composants, combinaisons)
  if (!verdict.ok) throw new Error(verdict.raison)
  const dossierFront = join(projet, front)
  const regles = []
  for (const [axe, valeur] of [['style', style], ['composants', composants]]) {
    const variante = await appliquerUne(join(dossier, axe, valeur), dossierFront)
    regles.push(...(variante.regles ?? []))
    const complement = join(dossier, axe, valeur, `avec-${style}`)
    if (axe === 'composants' && existsSync(complement)) regles.push(...((await appliquerUne(complement, dossierFront)).regles ?? []))
  }
  const cheminAda = join(projet, 'ada.json')
  const ada = await lireJson(cheminAda, {})
  await writeFile(cheminAda, `${JSON.stringify({ ...ada, edition: 'studio', style, composants }, null, 2)}\n`)
  for (const [fichier, section] of [
    ['AGENTS.md', sectionInterface(style, composants, regles, combinaisons)],
    ['docs/adr/0001-choix-de-la-stack.md', sectionAdr(style, composants, combinaisons)],
  ]) {
    const chemin = join(projet, fichier)
    if (existsSync(chemin)) await writeFile(chemin, remplacerSection(await readFile(chemin, 'utf8'), section))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [projet, front, style, composants] = process.argv.slice(2)
  if (!projet || !front || !style || !composants) {
    console.error('Usage : node scripts/variantes.mjs <dossier du projet> <dossier du front> <style> <composants>')
    process.exit(2)
  }
  try {
    await appliquerVariantes({ projet: resolve(projet), front, style, composants })
    console.log(`✔ ${style} + ${composants} appliqués à ${projet}`)
  } catch (erreur) {
    console.error(`✘ ${erreur.message}`)
    process.exit(1)
  }
}
