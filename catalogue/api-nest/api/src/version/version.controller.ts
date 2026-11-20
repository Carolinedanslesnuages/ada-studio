import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';

/** Contrat repo-version-json (format Dockerflow) : le fichier de l'image, sinon « dev ». */
export const VERSION_DEV = {
  source: '',
  version: 'dev',
  commit: '',
  build: '',
  code_date: '',
  changes: [],
  history: [],
};

/** Route technique (contrat repo-version-json) : hors de la documentation de l'API. */
@ApiExcludeController()
@Controller()
export class VersionController {
  @Get(['__version__', 'api/__version__'])
  @Header('Cache-Control', 'no-store')
  version(): unknown {
    try {
      return JSON.parse(readFileSync(process.env.VERSION_JSON ?? '/app/version.json', 'utf8'));
    } catch {
      return { ...VERSION_DEV };
    }
  }
}
