/**
 * Processus travailleur : exécute UNE tâche de l'assistant (analyse ou réalisation) hors de
 * l'API, pour survivre à ses redémarrages. Lancé par AgentService avec le chemin d'un fichier de
 * tâche (lisible par le seul utilisateur), supprimé dès sa lecture.
 */
import 'reflect-metadata';
import 'dotenv/config';
import { readFile, rm } from 'node:fs/promises';
import { ApercuService } from '../apercu/apercu.service.js';
import { lireConfig } from '../config.js';
import { exigerEdition } from '../edition/edition.js';
import { GithubService } from '../github/github.service.js';
import { DemandesStore } from '../stories/demandes.js';
import { StoriesService } from '../stories/stories.service.js';
import { ProjetsService } from '../projets/projets.service.js';
import type { Tache } from './agent.js';
import { AgentService } from './agent.service.js';

exigerEdition(); // jamais l'ADA du travail : fichier EDITION = studio
const fichierTache = process.argv[2];
if (!fichierTache) {
  console.error('Usage : node travailleur.js <fichier de tâche>');
  process.exit(1);
}
const tache = JSON.parse(await readFile(fichierTache, 'utf8')) as Tache;
await rm(fichierTache, { force: true });

const config = lireConfig();
const github = new GithubService();
const apercu = new ApercuService(config);
const agent = new AgentService(config, github, new StoriesService(config, github, new DemandesStore(config)), apercu, new ProjetsService(config, github, apercu));
agent.travailleurSepare = false;
console.log(`[${new Date().toISOString()}] ${tache.depot}#${tache.numero} : ${tache.phase} (processus ${process.pid})`);
try {
  await agent.executerTache(tache);
  console.log(`[${new Date().toISOString()}] ${tache.depot}#${tache.numero} : terminé`);
} catch (erreur) {
  // Erreurs survenues hors du suivi de la tâche (ex. projet invalide) : journalisées, sans pile brute.
  console.error(`[${new Date().toISOString()}] ${tache.depot}#${tache.numero} : échec — ${(erreur as Error).message}`);
  process.exitCode = 1;
}
