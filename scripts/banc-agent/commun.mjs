// Partie commune du banc d'essai de l'agent : réglages, lancement de l'agent comme le fait l'API, projet jetable.
import { spawn } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const API = join(RACINE, 'interface/api')

/** Le code d'ADA, compilé : le banc utilise les MÊMES consignes, outils et options que l'API. */
export async function chargerApi() {
  const agent = join(API, 'dist/agent/agent.js')
  if (!existsSync(agent)) {
    console.error('Compilez d’abord l’API : cd interface/api && npm run build')
    process.exit(1)
  }
  // L'agent est découpé par responsabilité (ADR-0012) : le banc en réunit les modules.
  const modules = ['agent', 'consignes', 'outils', 'reponses', 'activite'].map((nom) => import(join(API, `dist/agent/${nom}.js`)))
  return { agent: Object.assign({}, ...(await Promise.all(modules))), empreinte: await import(join(API, 'dist/empreinte/empreinte.js')) }
}

const developper = (chemin) => (chemin.startsWith('~') ? join(homedir(), chemin.slice(1)) : chemin)

/**
 * Réglages de l'agent : ceux de interface/api/.env (SEULEMENT les trois utiles, jamais les secrets),
 * remplaçables par BANC_COMMANDE, BANC_MODELE et BANC_SKILLS (dossiers séparés par des virgules).
 */
export function lireReglages() {
  const lus = {}
  const fichier = join(API, '.env')
  if (existsSync(fichier)) {
    for (const ligne of readFileSync(fichier, 'utf8').split('\n')) {
      const trouve = /^(AGENT_SKILLS|AGENT_COMMANDE|AGENT_MODELE)=(.*)$/.exec(ligne.trim())
      if (trouve) lus[trouve[1]] = trouve[2].trim()
    }
  }
  const dossiers = (process.env.BANC_SKILLS ?? lus.AGENT_SKILLS ?? '')
    .split(',')
    .map((chemin) => developper(chemin.trim()))
    .filter((chemin) => chemin && existsSync(join(chemin, 'SKILL.md')))
    .map((chemin) => realpathSync(chemin))
  return {
    commande: developper(process.env.BANC_COMMANDE ?? lus.AGENT_COMMANDE ?? 'claude'),
    modele: process.env.BANC_MODELE ?? (lus.AGENT_MODELE || 'sonnet'),
    skills: dossiers.map((dossier) => ({ nom: basename(dossier), dossier })),
  }
}

export const lireIndexRgaa = () => readFileSync(join(RACINE, 'skills/po/po-story/references/rgaa-4.1.2/README.md'), 'utf8')

/** Copie jetable d'un modèle du catalogue (sans node_modules), avec les skills reliées comme le fait l'API, et les fichiers du cas (piégés, par exemple). */
export function projetJetable(modele, skills, fichiers = {}) {
  const dossier = join(mkdtempSync(join(tmpdir(), 'banc-ada-')), 'projet')
  cpSync(join(RACINE, 'catalogue', modele), dossier, { recursive: true, filter: (source) => !source.includes('node_modules') })
  equiperSkills(dossier, skills)
  ecrireFichiers(dossier, fichiers)
  return dossier
}

/** Écrit (ou remplace) des fichiers d'un projet jetable : `{ 'AGENTS.md': '…' }`. */
export function ecrireFichiers(dossier, fichiers = {}) {
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(dossier, chemin)), { recursive: true })
    writeFileSync(join(dossier, chemin), contenu)
  }
}

export function equiperSkills(dossier, skills) {
  for (const racine of ['.claude/skills', '.agents/skills']) {
    mkdirSync(join(dossier, racine), { recursive: true })
    for (const skill of skills) if (!existsSync(join(dossier, racine, skill.nom))) symlinkSync(skill.dossier, join(dossier, racine, skill.nom))
  }
  const exclusions = join(dossier, '.git/info/exclude')
  if (existsSync(dirname(exclusions))) appendFileSync(exclusions, '/.claude/skills/\n/.agents/skills/\n')
}

/** Lance l'agent comme l'API (options d'isolement, outils de la phase) et suit ce qu'il fait. */
export function lancerAgent({ api, reglages, phase, consigne, cwd, tours, delaiMs = 900_000 }) {
  const { agent, empreinte } = api
  const args = [
    '-p', consigne, '--output-format', 'stream-json', '--verbose', '--model', reglages.modele, '--max-turns', String(tours),
    ...agent.OPTIONS_ISOLEMENT, '--no-session-persistence',
    '--disallowedTools', ...agent.OUTILS_INTERDITS,
    '--allowedTools', ...agent.outilsAutorises(phase, reglages.skills.map((skill) => skill.dossier)),
  ]
  // Comme l'API : l'agent ne reçoit jamais les secrets de l'environnement.
  const env = Object.fromEntries(Object.entries(process.env).filter(([nom]) => !/SECRET|TOKEN|KEY|PASSWORD/i.test(nom)))
  const debut = Date.now()
  return new Promise((resolvePromesse) => {
    const suivi = { resultat: '', usages: [], tours: 0, skills: new Set(), outils: {} }
    const processus = spawn(reglages.commande, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    const minuteur = setTimeout(() => processus.kill('SIGTERM'), delaiMs)
    let tampon = ''
    processus.stdout.on('data', (morceau) => {
      tampon += morceau
      const lignes = tampon.split('\n')
      tampon = lignes.pop()
      for (const ligne of lignes) {
        try {
          const evenement = JSON.parse(ligne)
          if (evenement.type === 'assistant') {
            suivi.tours++
            for (const bloc of evenement.message?.content ?? []) {
              if (bloc.type !== 'tool_use') continue
              suivi.outils[bloc.name] = (suivi.outils[bloc.name] ?? 0) + 1
              if (bloc.name === 'Skill') suivi.skills.add(String(bloc.input?.skill ?? '?'))
              const lu = String(bloc.input?.file_path ?? '')
              for (const skill of reglages.skills) if (lu.includes(skill.dossier)) suivi.skills.add(skill.nom)
            }
          }
          if (evenement.type === 'result') {
            suivi.resultat = evenement.result ?? ''
            suivi.usages = empreinte.lireUsages(evenement.modelUsage)
          }
        } catch {
          /* ligne qui n'est pas du JSON : ignorée */
        }
      }
    })
    processus.on('error', (erreur) => {
      clearTimeout(minuteur)
      resolvePromesse({ ...suivi, skills: [], secondes: 0, erreur: erreur.message })
    })
    processus.on('close', () => {
      clearTimeout(minuteur)
      const e = empreinte.empreinte(suivi.usages)
      resolvePromesse({ ...suivi, skills: [...suivi.skills], secondes: Math.round((Date.now() - debut) / 1000), tokensSortie: e.tokensSortie, co2g: (e.co2g.min + e.co2g.max) / 2 })
    })
  })
}

export const moyenne = (valeurs) => (valeurs.length ? Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length) : 0)

/** Exécute des tâches avec au plus `parallele` en même temps (comme AGENT_MAX_SIMULTANES). */
export async function enParallele(taches, parallele, executer) {
  let suivante = 0
  await Promise.all(Array.from({ length: parallele }, async () => {
    while (suivante < taches.length) await executer(taches[suivante++])
  }))
}
