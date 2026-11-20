import type { BilanProjets } from './registre.js';
import { describe, it, expect } from 'vitest';
import { calculerIndicateurs, lireHistorique, type DemandeMesuree } from './indicateurs.js';

const livree = (lanceeLe: string | null, fermeeLe: string): DemandeMesuree => ({ livree: true, lanceeLe, fermeeLe });
const ouverte: DemandeMesuree = { livree: false, lanceeLe: '2026-11-16T10:00:00Z', fermeeLe: null };

const AUCUN: BilanProjets = { total: 0, crees: 0, repris: 0, actifs: 0, archives: 0, retires: 0, supprimes: 0 };

describe('Indicateurs', () => {
  it('compte les projets et les stories livrées, sur l’ensemble et par projet', () => {
    const indicateurs = calculerIndicateurs([
      { nom: 'pret', demandes: [livree(null, '2026-11-16T12:00:00Z'), livree(null, '2026-11-16T13:00:00Z'), ouverte] },
      { nom: 'annuaire', demandes: [livree(null, '2026-11-16T12:00:00Z')] },
      { nom: 'vide', demandes: [] },
    ], AUCUN);
    expect(indicateurs.projets).toBe(3);
    expect(indicateurs.storiesLivrees).toBe(3);
    expect(indicateurs.parProjet.map((projet) => [projet.nom, projet.storiesLivrees])).toEqual([
      ['pret', 2],
      ['annuaire', 1],
      ['vide', 0],
    ]);
  });

  it('temps moyen du lancement à la livraison, en minutes, sans les demandes jamais lancées depuis ADA', () => {
    const indicateurs = calculerIndicateurs([
      { nom: 'pret', demandes: [livree('2026-11-16T10:00:00Z', '2026-11-16T10:20:00Z'), livree('2026-11-16T11:00:00Z', '2026-11-16T11:40:00Z'), livree(null, '2026-11-16T12:00:00Z')] },
    ], AUCUN);
    expect(indicateurs.dureeMoyenneMinutes).toBe(30);
    expect(calculerIndicateurs([{ nom: 'ancien', demandes: [livree(null, '2026-11-16T12:00:00Z')] }], AUCUN).dureeMoyenneMinutes).toBeNull();
  });

  it('lit le lancement dans l’historique des labels', () => {
    const historique = lireHistorique(
      [
        { event: 'labeled', created_at: '2026-11-16T10:05:00Z', label: { name: 'user-story' } },
        { event: 'labeled', created_at: '2026-11-16T10:10:00Z', label: { name: 'story:en-cours' } },
        { event: 'unlabeled', created_at: '2026-11-16T10:30:00Z', label: { name: 'story:en-cours' } },
        { event: 'labeled', created_at: '2026-11-16T10:31:00Z', label: { name: 'story:besoin-dev' } },
        { event: 'labeled', created_at: '2026-11-16T11:00:00Z', label: { name: 'story:en-cours' } },
        { event: 'closed', created_at: '2026-11-16T12:00:00Z' },
      ],
      'story:en-cours',
    );
    expect(historique).toEqual({ lanceeLe: '2026-11-16T10:10:00Z' });
    expect(lireHistorique([], 'story:en-cours')).toEqual({ lanceeLe: null });
  });
});
