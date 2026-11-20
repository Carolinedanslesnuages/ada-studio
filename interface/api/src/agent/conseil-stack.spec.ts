import { describe, expect, it } from 'vitest';
import { consigneConseilStack, lireConseilStack } from './conseil-stack.js';

describe('Conseil de stack à la création (#68)', () => {
  it('lit le choix et sa raison, même entourés de texte', () => {
    expect(lireConseilStack('Voici : {"modele": "vue-node", "raison": "  Simple   et rapide. "} Bonne journée', ['vue-node'])).toEqual({
      modele: 'vue-node',
      raison: 'Simple et rapide.',
    });
  });

  it('coupe une explication trop longue à la fin d’une phrase, sinon d’un mot', () => {
    const longue = `${'Une application solide pour durer. '.repeat(10)}et encore des détails`;
    expect(lireConseilStack(JSON.stringify({ modele: 'vue-node', raison: longue }), ['vue-node'])!.raison).toMatch(/durer\.$/);
    const sansPoint = 'mot '.repeat(100);
    const coupee = lireConseilStack(JSON.stringify({ modele: 'vue-node', raison: sansPoint }), ['vue-node'])!.raison;
    expect(coupee.length).toBeLessThanOrEqual(301);
    expect(coupee.endsWith('mot…')).toBe(true);
  });

  it('ignore une réponse illisible ou un modèle hors liste', () => {
    expect(lireConseilStack('je ne sais pas', ['vue-node'])).toBeNull();
    expect(lireConseilStack('{"modele": "inconnu", "raison": "x"}', ['vue-node'])).toBeNull();
    expect(lireConseilStack('{"modele": ', ['vue-node'])).toBeNull();
  });

  it('donne à ADA l’idée et la liste des modèles, et demande une réponse JSON sans outil', () => {
    const consigne = consigneConseilStack(
      'covoiturage entre agents',
      [{ id: 'vue-node', type: 'service', libelle: 'Vue 3 + Node.js', pourQuoi: 'Petite application' }],
      [{ id: 'service', libelle: 'Application en ligne', description: 'Des écrans' }],
    );
    expect(consigne).toContain('covoiturage entre agents');
    expect(consigne).toContain('- vue-node : Application en ligne — Vue 3 + Node.js (Petite application)');
    expect(consigne).toContain('UNIQUEMENT par un objet JSON');
    expect(consigne).toContain('N’utilise aucun outil'.replace('’', "'"));
  });
});
