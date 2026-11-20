import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { lireConfig } from './../src/config.js';
import { configurerApp } from './../src/configurer-app.js';

process.env.GITHUB_PROPRIETAIRE = 'proprio';
process.env.GITHUB_CLIENT_ID = 'Iv-test';
process.env.GITHUB_CLIENT_SECRET = 'secret-test';
process.env.SESSION_SECRET = 'x'.repeat(32);
process.env.DOSSIER_SESSIONS = mkdtempSync(join(tmpdir(), 'sessions-e2e-'));

describe('ADA (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configurerApp(app, lireConfig());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('refuse la liste des projets sans connexion GitHub', () => {
    return request(app.getHttpServer()).get('/api/projets').expect(401);
  });

  it('refuse de lancer une story sans connexion GitHub', () => {
    return request(app.getHttpServer()).post('/api/projets/poc/stories/1/lancer').expect(401);
  });

  it('n’offre plus de création de story dans l’atelier (elles s’écrivent dans GitHub)', () => {
    return request(app.getHttpServer()).post('/api/projets/poc/stories').send({}).expect(404);
  });

  it('renvoie vers GitHub avec un état anti-falsification', async () => {
    const reponse = await request(app.getHttpServer()).get('/api/auth/github').expect(302);
    const url = new URL(reponse.headers.location);
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('Iv-test');
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5700/api/auth/github/callback');
  });

  it('refuse un retour GitHub dont l’état ne correspond pas', async () => {
    const reponse = await request(app.getHttpServer())
      .get('/api/auth/github/callback?code=abc&state=falsifie')
      .expect(302);
    expect(reponse.headers.location).toBe('http://localhost:5700/connexion?erreur=etat');
  });

  it('revient à l’écran de connexion, sans JSON brut, si GitHub refuse l’échange', async () => {
    const agent = request.agent(app.getHttpServer());
    const depart = await agent.get('/api/auth/github').expect(302);
    const etat = new URL(depart.headers.location).searchParams.get('state');
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'incorrect_client_credentials' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
    try {
      const retour = await agent.get(`/api/auth/github/callback?code=abc&state=${etat}`).expect(302);
      expect(retour.headers.location).toBe('http://localhost:5700/connexion?erreur=github');
    } finally {
      globalThis.fetch = vraiFetch;
    }
  });

  it.each(['/__version__', '/api/__version__'])('sert la version sur %s (repli « dev »)', async (chemin) => {
    const reponse = await request(app.getHttpServer()).get(chemin).expect(200);
    expect(reponse.body.version).toBe('dev');
  });


});
