/**
 * Reprise d'un projet existant (#37) : l'assistant analyse le projet comme s'il avait été créé
 * avec ADA, puis ADA ouvre la PR de reprise (ada.json déduit) et propose les améliorations.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lireIdentifiant } from '../projets/depot.js';
import type { ProjetsService } from '../projets/projets.service.js';
import { adaJsonReprise, corpsReprise, fichiersAApporter, MODELE_REFERENCE, ouvrirPrReprise } from '../projets/reprise.js';
import { texteDecoupage } from '../stories/story.js';
import type { Tache } from './agent.js';
import { consigneReprise, lireAnalyseReprise } from './consigne-reprise.js';
import type { OutilsPhase } from './outils-phase.js';

export async function phaseReprise(outils: OutilsPhase, projets: ProjetsService, { jeton, login, depot, numero, reprise }: Tache): Promise<void> {
  const { stories } = outils;
  const { modele = null } = reprise ?? {};
  const stack = modele ? projets.modeles().modeles.find((m) => m.id === modele && m.disponible) : undefined;
  const dossierModele = join(projets.dossierCatalogue, stack?.id ?? MODELE_REFERENCE);
  const adaModele = stack ? await readFile(join(dossierModele, 'ada.json'), 'utf8') : null;

  await outils.noter(depot, numero, 'Prépare le projet');
  const cwd = await outils.apercu.preparerDepot(jeton, depot);
  const skills = await outils.equiperSkills(cwd);
  await outils.noter(depot, numero, 'Compare le projet à un projet créé avec ADA');
  const consigne = consigneReprise({ stack: stack && adaModele ? { libelle: stack.libelle, ada: adaModele } : null }, skills.noms);
  const analyse = lireAnalyseReprise(await outils.executer(depot, numero, 'reprise', consigne, cwd, skills.dossiers));
  if (!analyse) {
    await outils.bloquer(jeton, depot, numero, 'ADA n’a pas réussi à analyser le projet.');
    return;
  }

  // Aperçu : celui déduit par l'analyse ; à défaut, celui de la stack indiquée par le PO.
  let adaJson: string | null = null;
  for (const source of [analyse.ada, adaModele]) {
    if (adaJson || !source) continue;
    try {
      adaJson = adaJsonReprise(source);
    } catch (e) {
      outils.log.warn(`ada.json de reprise écarté (${depot}) : ${(e as Error).message.split('\n')[0]}`);
    }
  }
  if (!adaJson) {
    await stories.commenterAssistant(jeton, depot, numero, 'Analyse de la reprise', analyse.texte);
    await outils.bloquer(jeton, depot, numero, 'ADA n’a pas trouvé comment démarrer l’aperçu du projet : un développeur doit le décrire (ada.json).');
    return;
  }

  await outils.noter(depot, numero, 'Ouvre la pull request de reprise');
  const { owner, repo } = lireIdentifiant(depot, outils.config.GITHUB_PROPRIETAIRE);
  const gh = outils.github.client(jeton);
  const fichiers = await fichiersAApporter(gh, owner, repo, dossierModele, adaJson);
  const analyseUrl = `https://github.com/${owner}/${repo}/issues/${numero}`;
  const pr = await ouvrirPrReprise(gh, { owner, repo, login }, fichiers, corpsReprise({ stack: stack?.libelle ?? null, fichiers: [...fichiers.keys()], login, analyse: analyseUrl }));
  const suite = `**Pull request de reprise** : ${pr}\nFusionnez-la sur GitHub : le projet apparaîtra alors dans ADA.`;

  if (analyse.stories.length) {
    await stories.commenterAssistant(jeton, depot, numero, 'Analyse de la reprise', texteDecoupage(`${analyse.texte}\n\n${suite}`, analyse.stories));
    await stories.changerStatut(jeton, depot, numero, 'decoupage');
    await outils.noter(depot, numero, 'Terminé : fusionnez la reprise, puis choisissez les améliorations');
    return;
  }
  await stories.commenterAssistant(jeton, depot, numero, 'Analyse de la reprise', `${analyse.texte}\n\nAucune amélioration à proposer.\n\n${suite}`);
  await gh.issues.update({ owner, repo, issue_number: numero, state: 'closed', state_reason: 'completed' });
  await outils.noter(depot, numero, 'Terminé : fusionnez la reprise');
}
