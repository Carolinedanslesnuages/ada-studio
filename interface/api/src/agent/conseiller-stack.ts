/**
 * Conseil de stack à la création (#68) : l'assistant lit l'idée du PO et propose le modèle livré
 * le plus adapté, avec une phrase d'explication. Sans outil, dans un dossier vide et jetable.
 */
import { BadRequestException, ConflictException, HttpException, type Logger } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '../config.js';
import { IDEE_MAX } from '../projets/projet.js';
import type { ProjetsService } from '../projets/projets.service.js';
import { consigneConseilStack, lireConseilStack, OUTILS_CONSEIL_INTERDITS, type ConseilStack } from './conseil-stack.js';
import { optionModele, type LancerAgent } from './lancement.js';
import { OPTIONS_ISOLEMENT } from './outils.js';

/** Conseils de stack en même temps : chacun lance un agent, sans verrou de projet. */
const CONSEILS_MAX = 3;

export class ConseillerStack {
  private enCours = 0;

  constructor(
    private readonly config: Config,
    private readonly projets: ProjetsService,
    /** L'agent à lancer, lu à chaque conseil (les tests le remplacent). */
    private readonly lancerAgent: () => LancerAgent,
    private readonly log: Logger,
  ) {}

  async conseiller(idee: unknown): Promise<ConseilStack> {
    if (!this.config.AGENT_COMMANDE) {
      throw new BadRequestException('Aucun agent n’est configuré pour cet atelier (AGENT_COMMANDE). Choisissez la stack vous-même.');
    }
    const texte = typeof idee === 'string' ? idee.trim() : '';
    if (texte.length < 10 || texte.length > IDEE_MAX) {
      throw new BadRequestException('Racontez votre idée (une phrase au moins) pour qu’ADA puisse vous conseiller');
    }
    if (this.enCours >= CONSEILS_MAX) {
      throw new HttpException('ADA est très sollicitée en ce moment : réessayez dans un instant, ou choisissez la stack vous-même.', 429);
    }
    const { modeles, types } = this.projets.modeles();
    const disponibles = modeles.filter((modele) => modele.disponible);
    this.enCours++;
    let dossier = '';
    let reponse = '';
    try {
      dossier = await mkdtemp(join(tmpdir(), 'ada-conseil-'));
      const args = [
        '-p',
        consigneConseilStack(texte, disponibles, types),
        '--output-format',
        'stream-json',
        '--verbose',
        ...optionModele(this.config.AGENT_MODELE),
        '--max-turns',
        '2',
        ...OPTIONS_ISOLEMENT,
        '--no-session-persistence',
        '--disallowedTools',
        ...OUTILS_CONSEIL_INTERDITS,
      ];
      await this.lancerAgent()(args, dossier, (ligne) => {
        try {
          const evt = JSON.parse(ligne) as { type?: string; result?: string };
          if (evt.type === 'result' && typeof evt.result === 'string') reponse = evt.result;
        } catch {
          /* ligne non JSON : ignorée */
        }
      });
    } catch (e) {
      this.log.warn(`Conseil de stack impossible : ${(e as Error).message}`);
    } finally {
      this.enCours--;
      if (dossier) await rm(dossier, { recursive: true, force: true });
    }
    const conseil = lireConseilStack(reponse, disponibles.map((modele) => modele.id));
    if (!conseil) throw new ConflictException('ADA n’a pas pu proposer de stack : choisissez-la vous-même dans la liste.');
    return conseil;
  }
}
