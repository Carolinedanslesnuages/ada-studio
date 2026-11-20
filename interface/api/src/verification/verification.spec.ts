import { describe, it, expect } from 'vitest';
import { etatControles, numeroDepuisUrl, peutFusionner } from './verification.js';

const requis = ['Anti-fuite', 'API', 'Front'];
const run = (name: string, status: string, conclusion: string | null) => ({ name, status, conclusion, html_url: `https://x/${name}` });

describe('Contrôles d’une pull request', () => {
  it('donne l’état de chaque contrôle exigé, y compris ceux pas encore démarrés', () => {
    expect(etatControles([run('Anti-fuite', 'completed', 'success'), run('API', 'in_progress', null)], requis)).toEqual([
      { nom: 'Anti-fuite', etat: 'reussi', lien: 'https://x/Anti-fuite' },
      { nom: 'API', etat: 'en-cours', lien: 'https://x/API' },
      { nom: 'Front', etat: 'en-attente', lien: null },
    ]);
  });

  it('retient la dernière exécution d’un contrôle relancé', () => {
    expect(etatControles([run('API', 'completed', 'failure'), run('API', 'completed', 'success')], ['API'])[0]!.etat).toBe('reussi');
  });
});

describe('Peut-on fusionner ?', () => {
  const TITRE = 'feat: Page d’accueil';
  const verts = etatControles(requis.map((n) => run(n, 'completed', 'success')), requis);

  it('oui : PR ouverte, sans conflit, tout est vert', () => {
    expect(peutFusionner('ouverte', true, verts, TITRE)).toEqual({ fusionnable: true, raison: null });
  });

  it('non tant qu’un contrôle tourne', () => {
    const enCours = etatControles([...requis.slice(0, 2).map((n) => run(n, 'completed', 'success')), run('Front', 'queued', null)], requis);
    expect(peutFusionner('ouverte', true, enCours, TITRE)).toEqual({ fusionnable: false, raison: 'Contrôles en cours…' });
  });

  it('non si un contrôle a échoué, en le nommant', () => {
    const rouge = etatControles([run('Anti-fuite', 'completed', 'success'), run('API', 'completed', 'failure'), run('Front', 'completed', 'success')], requis);
    expect(peutFusionner('ouverte', true, rouge, TITRE).raison).toMatch(/« API » a échoué/);
  });

  it('non en cas de conflit, ou tant que GitHub ne sait pas', () => {
    expect(peutFusionner('ouverte', false, verts, TITRE).raison).toMatch(/conflit/);
    expect(peutFusionner('ouverte', null, verts, TITRE).raison).toMatch(/vérifie/);
  });

  it('non si le titre ne suit pas Conventional Commits : il décide de la version (semver)', () => {
    expect(peutFusionner('ouverte', true, verts, 'Page d’accueil').raison).toMatch(/feat: » ou « fix: »/);
    expect(peutFusionner('ouverte', true, verts, 'Merge pull request #6').fusionnable).toBe(false);
  });

  it('non si déjà fusionnée ou fermée', () => {
    expect(peutFusionner('fusionnee', true, verts, TITRE).fusionnable).toBe(false);
    expect(peutFusionner('fermee', true, verts, TITRE).fusionnable).toBe(false);
  });

  it('retrouve le numéro de la PR depuis son adresse', () => {
    expect(numeroDepuisUrl('https://github.com/p/poc/pull/3')).toBe(3);
    expect(numeroDepuisUrl(null)).toBeNull();
  });
});
