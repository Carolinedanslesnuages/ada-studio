// Garde-fou des scripts : ils ne tournent que dans ADA studio (fichier EDITION = studio à la racine),
// jamais dans l'ADA du travail (~/atelier-po).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const chemin = fileURLToPath(new URL('../EDITION', import.meta.url))
let edition = null
try {
  edition = readFileSync(chemin, 'utf8').trim()
} catch {
  edition = null
}
if (edition !== 'studio') {
  console.error(edition === null ? 'Ce n’est pas ADA studio : fichier EDITION manquant' : `Ce n’est pas ADA studio : le fichier EDITION contient « ${edition} »`)
  process.exit(1)
}
