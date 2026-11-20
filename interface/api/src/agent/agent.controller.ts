import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { ProjetGuard } from '../projets/projet.guard.js';
import { AgentService } from './agent.service.js';

@Controller('projets/:depot/stories/:numero')
@UseGuards(ConnecteGuard, ProjetGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get('activite')
  activite(@Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    return this.agent.activite(depot, numero);
  }

  /** Empreinte carbone estimée de cette demande (toutes les exécutions de l'agent). */
  @Get('empreinte')
  empreinte(@Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    return this.agent.empreinteDemande(depot, numero);
  }

  @Post('plan/valider')
  async valider(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    await this.agent.validerPlan(req.session.jeton!, req.session.utilisateur!.login, depot, numero);
    return { ok: true };
  }

  @Post('relancer')
  async relancer(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    await this.agent.relancer(req.session.jeton!, req.session.utilisateur!.login, depot, numero);
    return { ok: true };
  }

  /** Conversation : un nouveau message du PO ; ADA répond en agissant. */
  @Post('conversation/message')
  async message(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number, @Body('texte') texte: unknown) {
    await this.agent.reprendreConversation(req.session.jeton!, req.session.utilisateur!.login, depot, numero, texte);
    return { ok: true };
  }

  /** « C'est bon » : les changements de la conversation deviennent une PR (ou rien, s'il n'y en a pas). */
  @Post('conversation/terminer')
  terminer(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    return this.agent.terminerConversation(req.session.jeton!, req.session.utilisateur!.login, depot, numero);
  }

  /** Arrêter la conversation : rien n'est ajouté au projet. */
  @Post('conversation/arreter')
  async arreter(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    await this.agent.arreterConversation(req.session.jeton!, req.session.utilisateur!.login, depot, numero);
    return { ok: true };
  }

  /** Réponse aux questions, ou demande de modification du plan : l'assistant reprend son analyse. */
  @Post('reponse')
  async repondre(
    @Req() req: Request,
    @Param('depot') depot: string,
    @Param('numero', ParseIntPipe) numero: number,
    @Body('texte') texte: string,
  ) {
    await this.agent.reprendreAnalyse(req.session.jeton!, depot, numero, texte);
    return { ok: true };
  }
}
