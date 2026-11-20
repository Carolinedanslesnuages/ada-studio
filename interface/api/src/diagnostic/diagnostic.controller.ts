import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConnecteGuard } from '../auth/connecte.guard.js';
import { CONFIG, type Config } from '../config.js';
import { decrireErreurGithub } from '../github/erreurs.js';
import { GithubService } from '../github/github.service.js';
import { ProjetsService } from '../projets/projets.service.js';

/**
 * Ce que la GitHub App peut réellement faire au nom du PO connecté.
 * Aucun secret : comptes, type d'accès, permissions accordées, modèles livrés dans le catalogue.
 */
@Controller('diagnostic')
@UseGuards(ConnecteGuard)
export class DiagnosticController {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly github: GithubService,
    private readonly projets: ProjetsService,
  ) {}

  @Get()
  async diagnostic(@Req() req: Request): Promise<unknown> {
    const gh = this.github.client(req.session.jeton!);
    const installations = await gh.apps
      .listInstallationsForAuthenticatedUser()
      .then(({ data }) =>
        data.installations.map((i) => ({
          compte: i.account && 'login' in i.account ? i.account.login : null,
          accesAuxDepots: i.repository_selection,
          permissions: i.permissions,
        })),
      )
      .catch((e: unknown) => ({ erreur: decrireErreurGithub(e) }));
    const modeles = this.projets.modeles().modeles.map(({ id, disponible }) => ({ id, disponible }));
    return {
      utilisateur: req.session.utilisateur?.login,
      proprietaireDesProjets: this.config.GITHUB_PROPRIETAIRE,
      installations,
      modeles,
    };
  }
}
