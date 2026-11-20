import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EQUIVALENTS, G_CO2_PAR_KWH, empreinte, lireUsages } from './empreinte.js';
import { lireEmpreintes, noterEmpreinte, sommer, usagesDuTour, type EntreeEmpreinte } from './journal-empreinte.js';

describe('Empreinte carbone (méthode EcoLogits, équivalents ADEME)', () => {
  it('lit les tokens par modèle dans le rapport de Claude (lecture = entrée + cache)', () => {
    expect(
      lireUsages({ 'claude-opus-5-5': { inputTokens: 2, cacheReadInputTokens: 24027, cacheCreationInputTokens: 11007, outputTokens: 4 } }),
    ).toEqual([{ modele: 'claude-opus-5-5', tokensEntree: 35036, tokensSortie: 4 }]);
    expect(lireUsages(undefined)).toEqual([]);
  });

  it('une fourchette, dont l’ordre de grandeur suit EcoLogits pour un modèle de la taille d’Opus', () => {
    const resultat = empreinte([{ modele: 'claude-opus-5-5', tokensEntree: 0, tokensSortie: 1000 }]);
    // 64 GPU (2 000 milliards de paramètres) ; 200 à 600 milliards actifs ; PUE 1,09 à 1,14.
    expect(resultat.energieWh.min).toBeGreaterThan(9);
    expect(resultat.energieWh.min).toBeLessThan(13);
    expect(resultat.energieWh.max).toBeGreaterThan(24);
    expect(resultat.energieWh.max).toBeLessThan(32);
    // Électricité (384 g/kWh) plus une petite part de fabrication des serveurs.
    expect(resultat.co2g.min).toBeGreaterThan((resultat.energieWh.min / 1000) * G_CO2_PAR_KWH);
    expect(resultat.co2g.min).toBeLessThan((resultat.energieWh.min / 1000) * G_CO2_PAR_KWH * 1.5);
  });

  it('proportionnelle aux tokens produits ; un petit modèle coûte moins', () => {
    const un = empreinte([{ modele: 'claude-opus-5-5', tokensEntree: 0, tokensSortie: 1000 }]);
    const deux = empreinte([{ modele: 'claude-opus-5-5', tokensEntree: 0, tokensSortie: 2000 }]);
    expect(deux.co2g.max).toBeCloseTo(un.co2g.max * 2, 6);
    const haiku = empreinte([{ modele: 'claude-haiku-5-5', tokensEntree: 0, tokensSortie: 1000 }]);
    expect(haiku.co2g.max).toBeLessThan(un.co2g.max / 4);
    // Modèle inconnu : la plus prudente, comme Opus.
    expect(empreinte([{ modele: 'modele-inconnu', tokensEntree: 0, tokensSortie: 1000 }]).co2g.max).toBeCloseTo(un.co2g.max, 6);
  });

  it('équivalents officiels de l’ADEME (Impact CO2)', () => {
    expect(EQUIVALENTS).toEqual({
      streamingHeureG: 64,
      voitureKmG: 142.25,
      rechercheWebG: 1.23,
      tgvAllerRetourParisMarseilleG: 4400,
      avionAllerRetourParisNewYorkG: 2_060_000,
      ampouleLedW: 10,
    });
  });

  it('journal : une ligne par exécution, sans contenu, relu et additionné', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'empreinte-'));
    await noterEmpreinte(dossier, { le: '2026-11-18T10:00:00Z', projet: 'gladys', numero: 3, phase: 'conversation', usages: [{ modele: 'claude-opus-5-5', tokensEntree: 5, tokensSortie: 100 }] });
    await noterEmpreinte(dossier, { le: '2026-11-18T10:05:00Z', projet: 'gladys', numero: 3, phase: 'conversation', usages: [] });
    await noterEmpreinte(dossier, { le: '2026-11-18T10:10:00Z', projet: 'gladys', numero: 3, phase: 'conversation', usages: [{ modele: 'claude-opus-5-5', tokensEntree: 5, tokensSortie: 300 }] });
    const entrees = await lireEmpreintes(dossier);
    expect(entrees).toHaveLength(2);
    expect(sommer(entrees).tokensSortie).toBe(400);
    expect(await lireEmpreintes(join(dossier, 'absent'))).toEqual([]);
  });

  it('session reprise : Claude rapporte le total de la session ; on ne compte que la différence de chaque tour', () => {
    const tour = (le: string, sortie: number, entree: number, session: string | null = 'S1'): EntreeEmpreinte => ({
      le, projet: 'gladys', numero: 30, phase: 'conversation', session, usages: [{ modele: 'claude-opus-5-5', tokensEntree: entree, tokensSortie: sortie }],
    });
    const entrees = [tour('1', 173, 24029), tour('2', 177, 59971), tour('3', 500, 1000, null)];
    expect(usagesDuTour(entrees).map((usages) => usages[0]!.tokensSortie)).toEqual([173, 4, 500]);
    expect(sommer(entrees).tokensSortie).toBe(677);
    // Un modèle absent du tour précédent compte en entier ; jamais de négatif.
    const autre = usagesDuTour([tour('1', 100, 10), { ...tour('2', 50, 5), usages: [{ modele: 'claude-haiku-5-5', tokensEntree: 5, tokensSortie: 50 }] }])
    expect(autre[1]![0]).toEqual({ modele: 'claude-haiku-5-5', tokensEntree: 5, tokensSortie: 50 });
    expect(usagesDuTour([tour('1', 100, 10), tour('2', 80, 5)])[1]![0]!.tokensSortie).toBe(0);
  });
});
