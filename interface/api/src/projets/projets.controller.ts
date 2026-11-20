import { Body, Controller, Get, Logger, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { ProjetsService } from './projets.service.js';
import { RepriseService } from './reprise.service.js';
import { RegistreService } from '../indicateurs/registre.service.js';
import { AgentService } from '../agent/agent.service.js';

@Controller('projets')
@UseGuards(ConnecteGuard)
export class ProjetsController {
  private readonly journal = new Logger(ProjetsController.name);

  constructor(
    private readonly projets: ProjetsService,
    private readonly reprise: RepriseService,
    private readonly registre: RegistreService,
    private readonly agent: AgentService,
  ) {}

  /** Création (#68) : l'assistant lit l'idée du PO et propose la stack la plus adaptée, avec une raison. */
  @Post('conseil-stack')
  conseillerStack(@Body('idee') idee: unknown) {
    return this.agent.conseillerStack(idee);
  }

  @Get()
  lister(@Req() req: Request) {
    return this.projets.lister(req.session.jeton!, req.session.utilisateur!.login);
  }

  @Get('modeles')
  modeles(@Req() req: Request) {
    return this.projets.modeles();
  }

  /** Dépôts de l'organisation et du compte du PO qui ne sont pas encore dans ADA (#37). */
  @Get('a-reprendre')
  aReprendre(@Req() req: Request) {
    return this.reprise.lister(req.session.jeton!, req.session.utilisateur!.login);
  }

  /** Reprise d'un dépôt existant : ADA ouvre une PR « reprise par ADA » que le PO valide. */
  @Post('reprendre')
  async reprendre(@Req() req: Request, @Body() corps: unknown) {
    const resultat = await this.reprise.reprendre(req.session.jeton!, req.session.utilisateur!.login, corps);
    await this.registre.noter(resultat.id, 'repris', req.session.utilisateur!.login);
    return resultat;
  }

  @Post()
  async creer(@Req() req: Request, @Body() corps: unknown) {
    const login = req.session.utilisateur!.login;
    const resultat = await this.projets.creer(req.session.jeton!, login, corps);
    await this.registre.noter(resultat.projet.id, 'cree', login);
    // L'idée de départ (#68) : l'assistant s'en saisit aussitôt, comme pour « Prompter ».
    if (resultat.idee) {
      try {
        this.agent.verifierDisponible();
        await this.agent.analyser(req.session.jeton!, resultat.projet.id, resultat.idee, login);
      } catch (e) {
        this.journal.warn(`Idée de ${resultat.projet.id} non lancée : ${(e as Error).message}`);
      }
    }
    return resultat;
  }
}
