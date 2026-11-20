import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { ProjetGuard } from '../projets/projet.guard.js';
import { DemoService } from './demo.service.js';

@Controller('projets/:depot/demo')
@UseGuards(ConnecteGuard, ProjetGuard)
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get()
  etat(@Param('depot') depot: string) {
    return this.demo.etat(depot);
  }

  @Post()
  demarrer(@Req() req: Request, @Param('depot') depot: string) {
    return this.demo.demarrer(req.session.jeton!, depot);
  }
}
