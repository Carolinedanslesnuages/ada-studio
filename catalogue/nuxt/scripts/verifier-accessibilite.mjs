// Vérifie l'accessibilité de chaque page construite (.output/public) avec axe-core :
// titres, langue, étiquettes, alternatives des images, liens… Les contrastes, qui dépendent des
// styles réellement affichés, sont garantis par les jetons du projet (contrastes vérifiés) et vérifiés à la main.
// Usage : npm run generate && npm run verifier:accessibilite
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import axe from 'axe-core'
import { JSDOM, VirtualConsole } from 'jsdom'

const dossier = '.output/public'
const pages = readdirSync(dossier, { recursive: true }).filter((chemin) => String(chemin).endsWith('.html'))
if (pages.length === 0) {
  console.error('Aucune page construite : lancez d’abord « npm run generate ».')
  process.exit(1)
}

// Messages techniques de jsdom (canvas non simulé) sans intérêt pour la vérification.
const consoleSilencieuse = new VirtualConsole()

let erreurs = 0
for (const page of pages) {
  const fenetre = new JSDOM(readFileSync(join(dossier, String(page)), 'utf8'), { runScripts: 'outside-only', virtualConsole: consoleSilencieuse }).window
  fenetre.eval(axe.source)
  const resultat = await fenetre.axe.run(fenetre.document, { rules: { 'color-contrast': { enabled: false } } })
  for (const violation of resultat.violations) {
    erreurs++
    console.error(`✗ ${page} : ${violation.help} (${violation.id}) — ${violation.nodes.length} élément(s)`)
    for (const noeud of violation.nodes.slice(0, 3)) console.error(`    ${noeud.html.slice(0, 160)}`)
  }
  fenetre.close()
}
if (erreurs) {
  console.error(`\n${erreurs} problème(s) d’accessibilité sur ${pages.length} page(s).`)
  process.exit(1)
}
console.log(`✔ ${pages.length} page(s) vérifiée(s) : aucun problème d’accessibilité détecté automatiquement.`)
