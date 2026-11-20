import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DemandesStore, type DemandeFigee } from './demandes.js';

const figee = (numero: number, titre = 'Une demande'): DemandeFigee => ({
  numero,
  titre,
  type: 'story',
  contenu: { role: 'agent', besoin: 'voir', benefice: 'agir', criteres: ['c1'] },
  contenuBug: null,
  contenuLibre: null,
  parent: null,
  lanceeLe: '2026-11-18T10:00:00Z',
  lanceePar: 'po1',
});

describe('DemandesStore : l’état des demandes, propre à ADA', () => {
  const nouveau = () => {
    const racine = mkdtempSync(join(tmpdir(), 'store-'));
    return { racine, store: new DemandesStore({ DOSSIER_APERCUS: racine, GITHUB_PROPRIETAIRE: 'proprio' }) };
  };

  it('garde la demande figée, le statut et le journal, par projet et par numéro', async () => {
    const { store } = nouveau();
    await store.figer('poc', figee(2));
    await store.ecrireStatut('poc', 2, 'plan-a-valider');
    await store.ajouterMessage('poc', 2, { auteur: 'po1', texte: 'Bonjour' });
    expect(await store.lireFigee('poc', 2)).toMatchObject({ titre: 'Une demande', contenu: { criteres: ['c1'] } });
    expect(await store.lireStatut('poc', 2)).toBe('plan-a-valider');
    expect(await store.messages('poc', 2)).toMatchObject([{ id: 1, auteur: 'po1', texte: 'Bonjour' }]);
    expect(await store.lireFigee('autre', 2)).toBeNull();
    expect(await store.lireFigee('poc', 3)).toBeNull();
    expect(await store.lireStatut('poc', 3)).toBeNull();
  });

  it('refuse un identifiant de projet ou un numéro qui sortirait du dossier', async () => {
    const { store } = nouveau();
    await expect(store.lireFigee('../../etc', 1)).rejects.toThrow();
    await expect(store.ajouterMessage('a/../b', 1, { auteur: 'x', texte: 'y' })).rejects.toThrow();
    await expect(store.lireStatut('poc', -1)).rejects.toThrow(/invalide/);
    await expect(store.lireStatut('poc', 1.5)).rejects.toThrow(/invalide/);
  });

  it('des messages écrits en même temps (API et travailleur) sont tous gardés, dans un ordre stable', async () => {
    const { store } = nouveau();
    await Promise.all(Array.from({ length: 40 }, (_, rang) => store.ajouterMessage('poc', 1, { auteur: 'ADA', texte: `message ${rang}` })));
    const messages = await store.messages('poc', 1);
    expect(messages).toHaveLength(40);
    expect(new Set(messages.map((message) => message.texte)).size).toBe(40);
    expect(messages.map((message) => message.id)).toEqual(Array.from({ length: 40 }, (_, rang) => rang + 1));
  });

  it('ignore une ligne abîmée du journal (écriture interrompue) sans perdre les autres', async () => {
    const { racine, store } = nouveau();
    await store.ajouterMessage('poc', 1, { auteur: 'ADA', texte: 'avant' });
    const dossier = join(racine, 'poc', 'demandes');
    const [fichier] = readdirSync(dossier).filter((nom) => nom.endsWith('.jsonl'));
    writeFileSync(join(dossier, fichier!), `${JSON.stringify({ auteur: 'ADA', texte: 'avant', le: '' })}\n{"auteur":"ADA","tex\n${JSON.stringify({ auteur: 'ADA', texte: 'après', le: '' })}\n`);
    expect((await store.messages('poc', 1)).map((message) => message.texte)).toEqual(['avant', 'après']);
  });

  it('ignore un statut inconnu écrit dans le fichier (jamais pris pour un statut)', async () => {
    const { racine, store } = nouveau();
    mkdirSync(join(racine, 'poc', 'demandes'), { recursive: true });
    writeFileSync(join(racine, 'poc', 'demandes', '1.statut.json'), JSON.stringify({ statut: 'tout-autoriser' }));
    expect(await store.lireStatut('poc', 1)).toBeNull();
  });

  it('un nouveau lancement remplace la demande figée mais prolonge le journal', async () => {
    const { store } = nouveau();
    await store.figer('poc', figee(2, 'Avant'));
    await store.ajouterMessage('poc', 2, { auteur: 'po1', texte: 'premier lancement' });
    await store.figer('poc', figee(2, 'Après'));
    await store.ajouterMessage('poc', 2, { auteur: 'po1', texte: 'second lancement' });
    expect((await store.lireFigee('poc', 2))?.titre).toBe('Après');
    expect((await store.messages('poc', 2)).map((message) => message.texte)).toEqual(['premier lancement', 'second lancement']);
  });

  it('retient que les statuts de GitHub ont été repris, une seule fois par projet', async () => {
    const { store } = nouveau();
    expect(await store.statutsRepris('poc')).toBe(false);
    await store.marquerStatutsRepris('poc');
    expect(await store.statutsRepris('poc')).toBe(true);
    expect(await store.statutsRepris('autre')).toBe(false);
  });
});
