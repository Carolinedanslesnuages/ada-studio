import type { GithubService } from '../github/github.service.js';
import type { CibleDepot } from '../projets/depot.js';
import { LABEL_LIBRE } from './story.js';

/** Crée le label dans le dépôt s'il n'existe pas : GitHub refuse de poser un label inconnu. */
export async function assurerLabel(gh: ReturnType<GithubService['client']>, cible: CibleDepot, nom: string): Promise<void> {
  try {
    await gh.issues.getLabel({ ...cible, name: nom });
  } catch (e) {
    if ((e as { status?: number }).status !== 404) throw e;
    await gh.issues.createLabel({
      ...cible,
      name: nom,
      color: nom === LABEL_LIBRE ? '6a6af4' : '0063cb',
      description: nom === LABEL_LIBRE ? 'Demande libre du PO (mode sauvage, hors story)' : 'Statut géré par ADA',
    });
  }
}
