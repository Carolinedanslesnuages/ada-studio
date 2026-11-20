import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';

export class EtatApi {
  @ApiProperty({ example: 'ok', description: 'L’API répond' })
  statut!: 'ok';
}

@ApiTags('Santé')
@Controller()
export class SanteController {
  /** La racine du service mène à sa documentation (c'est elle que montre l'aperçu d'ADA). */
  @Get()
  @Redirect('/api/docs', 302)
  @ApiExcludeEndpoint()
  racine(): void {}

  @Get('api')
  @ApiOkResponse({ type: EtatApi, description: 'L’API est prête' })
  etat(): EtatApi {
    return { statut: 'ok' };
  }
}
