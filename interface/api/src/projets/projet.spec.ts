import { describe, it, expect } from 'vitest';
import { normaliserNom, personnaliser, slugifier, validerProjet } from './projet.js';

describe('Nom d’un nouveau projet', () => {
  it('transforme le nom en adresse de dépôt GitHub', () => {
    expect(slugifier('Réservation de salles')).toBe('reservation-de-salles');
    expect(slugifier('Suivi d’activité — 2027 !')).toBe('suivi-d-activite-2027');
  });

  it('remplace l’apostrophe droite, qui casserait le code généré', () => {
    expect(normaliserNom("  L'annuaire   des agents ")).toBe('L’annuaire des agents');
  });

  it('refuse les guillemets et chevrons', () => {
    const resultat = validerProjet({ nom: 'Projet "test" <b>', objectif: 'Un objectif assez long', modele: 'x' });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.erreurs.nom).toMatch(/Lettres, chiffres/);
  });

  it('accepte un nom accentué et ajoute un point final à l’objectif', () => {
    const resultat = validerProjet({
      nom: "L'annuaire des agents",
      objectif: 'Trouver   un collègue\net son bureau',
      modele: 'vue-nest',
    });
    expect(resultat).toEqual({
      ok: true,
      slug: 'l-annuaire-des-agents',
      projet: { nom: 'L’annuaire des agents', objectif: 'Trouver un collègue et son bureau.', modele: 'vue-nest', idee: '', visibilite: 'prive', baseline: '', deploye: false, style: 'css-maison', composants: 'aucune' },
    });
  });

  it('accepte une idée racontée librement, sans objectif : l’objectif vient de sa première phrase (#68)', () => {
    const resultat = validerProjet({
      nom: 'Covoiturage',
      modele: 'vue-nest',
      idee: '  bon en gros je voudrais que les agents puissent partager leurs trajets. genre le matin\net on verra pour le reste ',
    });
    expect(resultat).toMatchObject({
      ok: true,
      projet: {
        idee: 'bon en gros je voudrais que les agents puissent partager leurs trajets. genre le matin\net on verra pour le reste',
        objectif: 'bon en gros je voudrais que les agents puissent partager leurs trajets.',
      },
    });
  });

  it('exige une idée (ou un objectif), même courte', () => {
    expect(validerProjet({ nom: 'Covoiturage', modele: 'vue-nest' })).toMatchObject({ ok: false, erreurs: { idee: 'Racontez votre idée, même en quelques mots' } });
    expect(validerProjet({ nom: 'Covoiturage', modele: 'vue-nest', idee: 'trajets' })).toMatchObject({ ok: false, erreurs: { idee: expect.stringContaining('une phrase') } });
  });

  it('accepte une baseline facultative, sans apostrophe droite', () => {
    const resultat = validerProjet({ nom: 'POC Portail', objectif: 'Piloter sa journée d’agent', modele: 'x', baseline: "  Ma journée avec l'agent " });
    expect(resultat.ok && resultat.projet.baseline).toBe('Ma journée avec l’agent');
  });

  it('refuse une baseline trop longue ou avec des guillemets', () => {
    const longue = validerProjet({ nom: 'POC Portail', objectif: 'Piloter sa journée', modele: 'x', baseline: 'a'.repeat(81) });
    expect(longue.ok).toBe(false);
    const guillemets = validerProjet({ nom: 'POC Portail', objectif: 'Piloter sa journée', modele: 'x', baseline: 'Le "portail"' });
    expect(guillemets.ok).toBe(false);
    if (!guillemets.ok) expect(guillemets.erreurs.baseline).toMatch(/ponctuation simple/);
  });

  it('exige un objectif d’au moins une phrase', () => {
    const resultat = validerProjet({ nom: 'Annuaire', objectif: 'court', modele: 'x' });
    expect(resultat.ok).toBe(false);
  });
});

describe('Personnalisation du modèle', () => {
  it('remplace tous les marqueurs, partout', () => {
    const texte = '# __NOM_PROJET__ (__SLUG__)\n__OBJECTIF__ — __DATE__ par __PO__ — __NOM_PROJET__ — « __BASELINE__ »';
    expect(
      personnaliser(texte, { nom: 'Annuaire', slug: 'annuaire', objectif: 'Trouver.', date: '2026-11-16', po: 'po1', baseline: 'Qui fait quoi' }),
    ).toBe('# Annuaire (annuaire)\nTrouver. — 2026-11-16 par po1 — Annuaire — « Qui fait quoi »');
  });

  it('laisse la baseline vide si le PO n’en a pas donné (l’en-tête ne l’affiche alors pas)', () => {
    expect(
      personnaliser('service-description="__BASELINE__"', { nom: 'A', slug: 'a', objectif: 'B.', date: 'd', po: 'p', baseline: '' }),
    ).toBe('service-description=""');
  });
});
