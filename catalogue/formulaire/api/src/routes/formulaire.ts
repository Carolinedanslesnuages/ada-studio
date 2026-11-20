import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { versCsv, type Reponse } from '../formulaire/csv.ts';
import type { Formulaire } from '../formulaire/definition.ts';
import { validerReponse, type Valeurs } from '../formulaire/validation.ts';

/** Le formulaire, l'enregistrement d'une réponse, la liste des réponses et leur export CSV. */
export function routesFormulaire(base: DatabaseSync, formulaire: Formulaire): Router {
  const routes = Router();

  const lireReponses = (): Reponse[] =>
    base
      .prepare('SELECT id, recueillie_le, valeurs FROM reponses ORDER BY id DESC')
      .all()
      .map((ligne) => ({
        id: Number(ligne.id),
        recueillieLe: String(ligne.recueillie_le),
        valeurs: JSON.parse(String(ligne.valeurs)) as Valeurs,
      }));

  routes.get('/formulaire', (_requete, reponse) => {
    reponse.json(formulaire);
  });

  routes.post('/reponses', (requete, reponse) => {
    const resultat = validerReponse(formulaire, requete.body);
    if (!resultat.valide) {
      reponse.status(400).json({ erreur: 'Le formulaire contient des erreurs', erreurs: resultat.erreurs });
      return;
    }
    const enregistrement = base
      .prepare('INSERT INTO reponses (recueillie_le, valeurs) VALUES (?, ?)')
      .run(new Date().toISOString(), JSON.stringify(resultat.valeurs));
    reponse.status(201).json({ id: Number(enregistrement.lastInsertRowid) });
  });

  routes.get('/reponses', (_requete, reponse) => {
    reponse.set('Cache-Control', 'no-store').json(lireReponses());
  });

  routes.get('/reponses.csv', (_requete, reponse) => {
    reponse
      .set('Cache-Control', 'no-store')
      .type('text/csv; charset=utf-8')
      .attachment('reponses.csv')
      .send(versCsv(formulaire, lireReponses()));
  });

  return routes;
}
