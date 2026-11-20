import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { ProjetGuard } from '../projets/projet.guard.js';
import { AgentService } from '../agent/agent.service.js';

/** Empreinte carbone estimée d'un projet, toutes demandes confondues : affichée à l'accueil du projet. */
@Controller('projets/:depot/empreinte')
@UseGuards(ConnecteGuard, ProjetGuard)
export class EmpreinteProjetController {
  constructor(private readonly agent: AgentService) {}

  @Get()
  lire(@Param('depot') depot: string) {
    return this.agent.empreinteProjet(depot);
  }
}
