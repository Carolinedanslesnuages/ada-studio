import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configurerApp } from './../src/configurer-app.js';

describe('Application (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurerApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('répond sous /api', async () => {
    const reponse = await request(app.getHttpServer()).get('/api').expect(200);
    expect(reponse.body).toEqual({ statut: 'ok' });
  });

  it('la racine mène à la documentation de l’API', async () => {
    const reponse = await request(app.getHttpServer()).get('/').expect(302);
    expect(reponse.headers.location).toBe('/api/docs');
  });

  it('sert la documentation interactive et sa description OpenAPI', async () => {
    const page = await request(app.getHttpServer()).get('/api/docs').expect(200);
    expect(page.text).toContain('swagger-ui');
    const openapi = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(openapi.body.info.title).toBe('__NOM_PROJET__');
    expect(Object.keys(openapi.body.paths)).toEqual(expect.arrayContaining(['/api']));
    expect(Object.keys(openapi.body.paths)).toEqual(['/api']);
  });

  it('refuse une entrée qui ne respecte pas son DTO (validation globale)', async () => {
    // Aucune route d'écriture dans le modèle : on vérifie que la validation est bien branchée.
    const pipes = (app as unknown as { config: { getGlobalPipes(): unknown[] } }).config.getGlobalPipes();
    expect(pipes.map((pipe) => (pipe as object).constructor.name)).toContain('ValidationPipe');
  });

  it.each(['/__version__', '/api/__version__'])(
    'sert la version sur %s, en repli « dev » hors image',
    async (chemin) => {
      const reponse = await request(app.getHttpServer()).get(chemin).expect(200);
      expect(reponse.headers['content-type']).toMatch(/application\/json/);
      expect(reponse.body).toEqual({
        source: '',
        version: 'dev',
        commit: '',
        build: '',
        code_date: '',
        changes: [],
        history: [],
      });
    },
  );
});
