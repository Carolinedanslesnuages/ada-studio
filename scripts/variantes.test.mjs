// Tests de la fonction unique d'application des variantes : node --test scripts/variantes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appliquerVariantes, lireCombinaisons, sectionInterface, verifierCombinaison } from './variantes.mjs'

/** Petit projet : un front minimal, ses consignes et son ADR, comme un modèle du catalogue. */
function projet() {
  const dossier = mkdtempSync(join(tmpdir(), 'variantes-'))
  cpSync(new URL('../catalogue/vue-nest/front/package.json', import.meta.url), join(dossier, 'package.json'))
  writeFileSync(join(dossier, 'ada.json'), JSON.stringify({ type: 'service', edition: 'studio' }))
  writeFileSync(join(dossier, 'AGENTS.md'), '# Projet\n\n<!-- ada:interface:debut -->\nancienne\n<!-- ada:interface:fin -->\n\n## Accessibilité\n')
  return dossier
}

test('les treize combinaisons autorisées passent, les cinq interdites sont refusées avec leur raison', () => {
  const combinaisons = lireCombinaisons()
  let autorisees = 0
  for (const style of combinaisons.styles) {
    for (const composants of combinaisons.composants) {
      const verdict = verifierCombinaison(style.valeur, composants.valeur)
      const interdite = combinaisons.interdites.some((regle) => regle.style === style.valeur && regle.composants === composants.valeur)
      assert.equal(verdict.ok, !interdite, `${style.valeur} + ${composants.valeur}`)
      if (verdict.ok) autorisees++
      else assert.match(verdict.raison, /\.$/)
    }
  }
  assert.equal(autorisees, 13)
})

test('une combinaison interdite est refusée par la fonction d’application, sans rien modifier', async () => {
  const dossier = projet()
  const avant = readFileSync(join(dossier, 'package.json'), 'utf8')
  await assert.rejects(appliquerVariantes({ projet: dossier, front: '.', style: 'css-maison', composants: 'shadcn-vue' }), /Tailwind/)
  await assert.rejects(appliquerVariantes({ projet: dossier, front: '.', style: 'unocss', composants: 'vuetify' }), /conflit/)
  await assert.rejects(appliquerVariantes({ projet: dossier, front: '.', style: 'bootstrap', composants: 'aucune' }), /Style inconnu/)
  assert.equal(readFileSync(join(dossier, 'package.json'), 'utf8'), avant)
})

test('applique le style puis la bibliothèque : dépendances, fichiers, ada.json, AGENTS.md', async () => {
  const dossier = projet()
  await appliquerVariantes({ projet: dossier, front: '.', style: 'tailwind', composants: 'primevue' })
  const paquet = JSON.parse(readFileSync(join(dossier, 'package.json'), 'utf8'))
  assert.equal(paquet.devDependencies.tailwindcss, '4.3.4')
  assert.equal(paquet.dependencies.primevue, '4.5.5')
  assert.equal(paquet.devDependencies['tailwindcss-primeui'], '0.6.1', 'complément propre à PrimeVue avec Tailwind')
  assert.match(readFileSync(join(dossier, 'src/styles/principal.css'), 'utf8'), /tailwindcss-primeui/)
  assert.deepEqual(JSON.parse(readFileSync(join(dossier, 'ada.json'), 'utf8')), { type: 'service', edition: 'studio', style: 'tailwind', composants: 'primevue' })
  const consignes = readFileSync(join(dossier, 'AGENTS.md'), 'utf8')
  assert.match(consignes, /Bibliothèque de composants : \*\*PrimeVue\*\*/)
  assert.doesNotMatch(consignes, /ancienne/)
  assert.match(consignes, /## Accessibilité/)
})

test('la section « Interface » impose la bibliothèque, interdit d’en ajouter une autre et exige une story par composant', () => {
  const section = sectionInterface('unocss', 'naive-ui', [])
  assert.match(section, /Utilise d'abord les composants de Naive UI ; n'installe aucune autre bibliothèque/)
  assert.match(section, /Tout nouveau composant réutilisable arrive avec sa story/)
  assert.match(section, /https:\/\/unocss\.dev/)
})
