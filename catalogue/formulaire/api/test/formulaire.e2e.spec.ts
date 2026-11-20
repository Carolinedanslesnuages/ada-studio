import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { creerApp } from '../src/app.ts';
import { ouvrirBase } from '../src/base.ts';
import { FORMULAIRE } from '../src/formulaire/definition.ts';

const reponseValide = { nom: 'Camille Martin', courriel: 'camille@exemple.fr', service: 'Informatique', sujets: ['Formation'] };

describe('Formulaire et réponses (e2e)', () => {
  let app: Express;
  beforeEach(() => {
    app = creerApp(ouvrirBase(':memory:'));
  });

  it('sert la définition du formulaire', async () => {
    const reponse = await request(app).get('/api/formulaire').expect(200);
    expect(reponse.body).toEqual(FORMULAIRE);
  });

  it('enregistre une réponse valide et la restitue', async () => {
    const creation = await request(app).post('/api/reponses').send(reponseValide).expect(201);
    expect(creation.body).toEqual({ id: 1 });
    const liste = await request(app).get('/api/reponses').expect(200);
    expect(liste.body).toEqual([{ id: 1, recueillieLe: expect.any(String), valeurs: reponseValide }]);
  });

  it('refuse une réponse invalide, en nommant chaque champ en erreur, sans rien enregistrer', async () => {
    const refus = await request(app).post('/api/reponses').send({ courriel: 'non' }).expect(400);
    expect(refus.body.erreurs).toEqual({
      nom: 'Le champ « Nom et prénom » est obligatoire',
      courriel: 'Adresse électronique invalide. Format attendu : nom@domaine.fr',
      service: 'Le champ « Votre service » est obligatoire',
    });
    expect((await request(app).get('/api/reponses')).body).toEqual([]);
  });

  it('exporte les réponses en CSV téléchargeable', async () => {
    await request(app).post('/api/reponses').send(reponseValide);
    const csv = await request(app).get('/api/reponses.csv').expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toMatch(/attachment; filename="?reponses\.csv"?/);
    expect(csv.text).toContain('"Camille Martin";"camille@exemple.fr";"Informatique";"Formation";""');
  });
});
