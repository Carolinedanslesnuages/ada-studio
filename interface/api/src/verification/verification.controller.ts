import { Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { ProjetGuard } from '../projets/projet.guard.js';
import { VerificationService } from './verification.service.js';

@Controller('projets/:depot/stories/:numero')
@UseGuards(ConnecteGuard, ProjetGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get('verification')
  verifier(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    return this.verification.verifier(req.session.jeton!, depot, numero);
  }

  /** Contrôles que GitHub n'a pas lancés (facturation) : relancés une fois la cause réglée. */
  @Post('controles/relancer')
  relancerControles(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    return this.verification.relancerControles(req.session.jeton!, depot, numero);
  }

  @Post('fusionner')
  fusionner(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    return this.verification.fusionner(req.session.jeton!, depot, numero);
  }
}
