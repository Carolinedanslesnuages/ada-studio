import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { IndicateursService } from './indicateurs.service.js';

@Controller('indicateurs')
@UseGuards(ConnecteGuard)
export class IndicateursController {
  constructor(private readonly indicateurs: IndicateursService) {}

  /** Empreinte carbone estimée de l'usage d'ADA (méthode EcoLogits, équivalents ADEME). */
  @Get('empreinte')
  empreinte(@Req() req: Request) {
    return this.indicateurs.empreinte(req.session.jeton!, req.session.utilisateur!.login);
  }

  @Get()
  lire(@Req() req: Request) {
    return this.indicateurs.calculer(req.session.jeton!, req.session.utilisateur!.login);
  }
}
