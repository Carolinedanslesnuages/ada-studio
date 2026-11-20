import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { ProjetGuard } from './projet.guard.js';
import { RepriseService } from './reprise.service.js';

/** Reprise lancée (#37) : suivi de l'analyse, puis validation de la PR de reprise depuis ADA. */
@Controller('projets/:depot/reprise')
@UseGuards(ConnecteGuard, ProjetGuard)
export class RepriseController {
  constructor(private readonly reprise: RepriseService) {}

  @Get()
  etat(@Req() req: Request, @Param('depot') depot: string) {
    return this.reprise.etat(req.session.jeton!, depot);
  }

  @Post('controles/relancer')
  relancerControles(@Req() req: Request, @Param('depot') depot: string) {
    return this.reprise.relancerControles(req.session.jeton!, depot);
  }

  /** Annule une reprise en attente, ou désynchronise un projet repris ; rien n'est supprimé. */
  @Post('annuler')
  annuler(@Req() req: Request, @Param('depot') depot: string) {
    return this.reprise.annuler(req.session.jeton!, req.session.utilisateur!.login, depot);
  }

  @Post('fusionner')
  fusionner(@Req() req: Request, @Param('depot') depot: string) {
    return this.reprise.fusionner(req.session.jeton!, depot);
  }
}
