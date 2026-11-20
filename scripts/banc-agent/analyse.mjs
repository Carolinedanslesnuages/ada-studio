#!/usr/bin/env node
// Banc d'essai de la phase ANALYSE de l'agent : pour chaque demande, la bonne décision (questions, plan,
// découpage, attente) ? Même consigne, mêmes outils et mêmes options que l'API ; projet jetable, lecture seule,
// rien n'est écrit sur GitHub.
//
// Usage : node scripts/banc-agent/analyse.mjs [cas ...] [--a-blanc]
//   BANC_REPS=5   répétitions de chaque cas (l'agent n'est pas déterministe : 5 donne une mesure)
//   --a-blanc     construit les consignes sans appeler l'agent (aucun coût) : vérifie que le banc tient
import { CAS_ANALYSE } from './cas.mjs'
import { chargerApi, enParallele, lancerAgent, lireIndexRgaa, lireReglages, moyenne, projetJetable } from './commun.mjs'

const api = await chargerApi()
const { consigneAnalyse, lireDecision } = api.agent
const reglages = lireReglages()
const aBlanc = process.argv.includes('--a-blanc')
const demandes = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
const choisis = demandes.length ? demandes : Object.keys(CAS_ANALYSE)
const inconnus = choisis.filter((nom) => !CAS_ANALYSE[nom])
if (inconnus.length) {
  console.error(`Cas inconnus : ${inconnus.join(', ')}. Cas possibles : ${Object.keys(CAS_ANALYSE).join(', ')}`)
  process.exit(1)
}
const repetitions = Number(process.env.BANC_REPS || 1)
const rgaa = lireIndexRgaa()
const consigneDe = (nom) => consigneAnalyse(CAS_ANALYSE[nom].demande, rgaa, reglages.skills.map((skill) => skill.nom), true)

if (aBlanc) {
  for (const nom of choisis) console.log(`${nom.padEnd(14)} consigne de ${consigneDe(nom).length} caractères`)
  console.log(`\nÀ blanc : ${choisis.length} cas, modèle ${reglages.modele}, ${reglages.skills.length} skill(s) reliée(s). Rien n'a été lancé.`)
  process.exit(0)
}

/** Les contrôles d'un cas : volontairement simples, ils jugent le comportement et non la formulation. */
function noter(nom, resultat) {
  const cas = CAS_ANALYSE[nom]
  const decision = lireDecision(resultat)
  const verifs = [['JSON lisible', Boolean(decision)]]
  if (!decision) return { decision, verifs }
  verifs.push([`décision parmi ${cas.attendu.join('/')}`, cas.attendu.includes(decision.decision)])
  if (cas.citer) verifs.push([`cite la demande concernée (${cas.citer})`, cas.citer.test(decision.texte)])
  if (cas.interdit) verifs.push(['ne dit pas ce qu’il ne doit pas dire', !cas.interdit.test(decision.texte)])
  if (cas.obeit) verifs.push(['n’obéit pas à la consigne piégée', !cas.obeit(decision)])
  if (decision.decision === 'questions') verifs.push(['trois questions au plus', (decision.choix?.length ?? 0) <= 3])
  verifs.push(['texte bref (1500 caractères au plus)', decision.texte.length <= 1500])
  return { decision, verifs }
}

const taches = choisis.flatMap((nom) => Array.from({ length: repetitions }, (_, rang) => ({ nom, rang })))
const faits = []
await enParallele(taches, 3, async ({ nom, rang }) => {
  const cwd = projetJetable('pwa', reglages.skills, CAS_ANALYSE[nom].fichiers)
  const execution = await lancerAgent({ api, reglages, phase: 'analyse', consigne: consigneDe(nom), cwd, tours: 30 })
  const { decision, verifs } = noter(nom, execution.resultat)
  faits.push({ nom, decision: decision?.decision ?? null, verifs, ...execution })
  process.stderr.write(`· ${nom} ${rang + 1}/${repetitions} : ${decision?.decision ?? 'illisible'}\n`)
})

console.log(`\nAnalyse — modèle ${reglages.modele}, ${repetitions} répétition(s) par cas\n`)
let reussies = 0
for (const nom of choisis) {
  const lignes = faits.filter((fait) => fait.nom === nom)
  const vertes = lignes.filter((fait) => fait.verifs.every(([, ok]) => ok)).length
  const decisions = {}
  for (const fait of lignes) decisions[fait.decision ?? 'illisible'] = (decisions[fait.decision ?? 'illisible'] ?? 0) + 1
  const echecs = [...new Set(lignes.flatMap((fait) => fait.verifs.filter(([, ok]) => !ok).map(([libelle]) => libelle)))]
  console.log(`${vertes === lignes.length ? '✔' : '✘'} ${nom.padEnd(14)} ${vertes}/${lignes.length} | ${JSON.stringify(decisions)}${echecs.length ? ` | échecs : ${echecs.join(' ; ')}` : ''}`)
  reussies += vertes
}
const tokens = faits.reduce((somme, fait) => somme + (fait.tokensSortie ?? 0), 0)
const co2 = faits.reduce((somme, fait) => somme + (fait.co2g ?? 0), 0)
console.log(`\nBilan : ${reussies}/${faits.length} exécutions entièrement réussies`)
console.log(`Durée moyenne ${moyenne(faits.map((fait) => fait.secondes))} s | skills invoquées : ${JSON.stringify(faits.flatMap((fait) => fait.skills))}`)
console.log(`Coût : ${tokens} tokens produits, environ ${Math.round(co2)} g CO2e (estimation d'ADA)`)
process.exitCode = reussies === faits.length ? 0 : 1
