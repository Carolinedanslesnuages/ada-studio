import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { ProjetGuard } from './projet.guard.js';
import { ProjetsService } from './projets.service.js';

/** À l'ouverture d'un projet : ADA vérifie que sa branche principale est protégée, et la protège sinon. */
@Controller('projets/:depot/protection')
@UseGuards(ConnecteGuard, ProjetGuard)
export class ProtectionController {
  constructor(private readonly projets: ProjetsService) {}

  @Post()
  assurer(@Req() req: Request, @Param('depot') depot: string) {
    return this.projets.assurerProtection(req.session.jeton!, depot);
  }

  /** Projet repris : le PO accepte qu'ADA protège la branche principale. */
  @Post('poser')
  poser(@Req() req: Request, @Param('depot') depot: string) {
    return this.projets.protegerSurDemande(req.session.jeton!, depot, req.session.utilisateur!.login);
  }

  /** Projet repris : le PO ne veut pas la protéger ; ADA ne redemande plus. */
  @Post('refuser')
  refuser(@Req() req: Request, @Param('depot') depot: string) {
    return this.projets.refuserProtection(depot, req.session.utilisateur!.login);
  }
}
