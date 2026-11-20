import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { join } from 'node:path';
import { commandeComposants } from './apercu.js';
import { ApercuService } from './apercu.service.js';

/** État du Storybook d'un projet, dans l'onglet « Composants » de l'atelier. */
export interface Composants {
  etat: 'indisponible' | 'arrete' | 'demarrage' | 'pret';
  url: string | null;
}

/**
 * Onglet « Composants » : le Storybook du projet, lancé à la demande dans le conteneur de son
 * aperçu, pour voir les composants (tous leurs états) sans lire de code. Il suit les fichiers du
 * projet : une story ajoutée par l'agent apparaît d'elle-même.
 */
@Injectable()
export class ComposantsService {
  private readonly journal = new Logger(ComposantsService.name);
  private readonly lances = new Set<string>();

  constructor(private readonly apercu: ApercuService) {}

  async etat(projet: string): Promise<Composants> {
    const config = await this.apercu.lireConfig(this.apercu.cheminDepot(projet)).catch(() => null);
    if (!config?.interface) return { etat: 'indisponible', url: null };
    if (!this.apercu.apercuDemarre(projet)) return { etat: 'arrete', url: null };
    const url = `http://localhost:${await this.apercu.portComposants(projet)}`;
    if (await this.apercu.repond(url)) return { etat: 'pret', url };
    return { etat: this.lances.has(projet) ? 'demarrage' : 'arrete', url: null };
  }

  /** Lance Storybook dans le conteneur de l'aperçu (déjà démarré), en arrière-plan. */
  async demarrer(projet: string): Promise<Composants> {
    const config = await this.apercu.lireConfig(this.apercu.cheminDepot(projet));
    const commande = commandeComposants(config);
    if (!commande) throw new BadRequestException('Ce projet n’a pas d’interface : il n’a pas de composants à montrer.');
    if (!this.apercu.apercuDemarre(projet)) throw new BadRequestException('Démarrez d’abord l’aperçu du projet.');
    const etat = await this.etat(projet);
    if (etat.etat === 'pret' || this.lances.has(projet)) return etat;
    try {
      await this.apercu.executer('docker', ['compose', '-f', 'compose.yml', 'exec', '-d', '-u', '1000', 'app', 'bash', '-c', commande], {
        cwd: join(this.apercu.dossierProjet(projet)),
      });
      this.lances.add(projet);
    } catch (e) {
      this.journal.warn(`Composants de ${projet} : ${(e as Error).message.split('\n')[0]}`);
      throw new BadRequestException('Les composants n’ont pas pu être affichés. Réessayez ; si cela persiste, prévenez un développeur.');
    }
    return { etat: 'demarrage', url: null };
  }
}
