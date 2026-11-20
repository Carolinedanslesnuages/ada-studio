import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { ProjetGuard } from '../projets/projet.guard.js';
import { AgentService } from '../agent/agent.service.js';
import { StoriesService } from './stories.service.js';
import { RepriseService } from '../projets/reprise.service.js';

@Controller('projets/:depot/stories')
@UseGuards(ConnecteGuard, ProjetGuard)
export class StoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly agent: AgentService,
    private readonly reprise: RepriseService,
  ) {}

  @Get()
  lister(@Req() req: Request, @Param('depot') depot: string) {
    return this.stories.lister(req.session.jeton!, depot);
  }

  /** Développeurs assignables (déclaré avant « :numero »). */
  @Get('developpeurs')
  developpeurs(@Req() req: Request, @Param('depot') depot: string) {
    return this.stories.developpeurs(req.session.jeton!, depot);
  }

  @Get(':numero')
  detail(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number) {
    return this.stories.detail(req.session.jeton!, depot, numero);
  }

  /** Assigne (ou, avec `null`, retire) le développeur d'une demande bloquée. */
  @Post(':numero/assigner')
  assigner(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number, @Body('login') login: unknown) {
    return this.stories.assigner(req.session.jeton!, depot, numero, login === undefined ? null : login);
  }

  /** Découpage validé : ADA publie les stories cochées, telles que le PO les a relues. */
  @Post(':numero/decoupage')
  creerDecoupage(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number, @Body('stories') stories: unknown) {
    return this.stories.creerDecoupage(req.session.jeton!, depot, numero, stories, req.session.utilisateur!.login);
  }

  /** Mode sauvage : le prompt est enregistré comme issue et lancé ; l'assistant propose un plan. */
  @Post('prompt')
  async prompter(@Req() req: Request, @Param('depot') depot: string, @Body('texte') texte: unknown) {
    await this.agent.verifierLancable(req.session.jeton!, depot);
    await this.reprise.verifierRepriseTerminee(req.session.jeton!, depot);
    const demande = await this.stories.prompter(req.session.jeton!, depot, texte, req.session.utilisateur!.login);
    await this.agent.analyser(req.session.jeton!, depot, demande.numero, req.session.utilisateur!.login);
    return demande;
  }

  /** Conversation (« vrai prompt ») : le premier message devient une issue ; ADA répond en agissant. */
  @Post('conversation')
  async ouvrirConversation(@Req() req: Request, @Param('depot') depot: string, @Body('texte') texte: unknown) {
    await this.agent.verifierLancable(req.session.jeton!, depot);
    await this.reprise.verifierRepriseTerminee(req.session.jeton!, depot);
    const login = req.session.utilisateur!.login;
    const conversation = await this.stories.ouvrirConversation(req.session.jeton!, depot, texte, login);
    await this.agent.converser(req.session.jeton!, login, depot, conversation.numero);
    return conversation;
  }

  /** Lance la demande, puis l'assistant commence son analyse (questions ou plan). */
  @Post(':numero/lancer')
  async lancer(@Req() req: Request, @Param('depot') depot: string, @Param('numero', ParseIntPipe) numero: number, @Body('empreinte') empreinte: unknown) {
    await this.agent.verifierLancable(req.session.jeton!, depot);
    await this.reprise.verifierRepriseTerminee(req.session.jeton!, depot);
    const lancee = await this.stories.lancer(req.session.jeton!, depot, numero, req.session.utilisateur!.login, empreinte);
    await this.agent.analyser(req.session.jeton!, depot, numero, req.session.utilisateur!.login);
    return lancee;
  }

}
