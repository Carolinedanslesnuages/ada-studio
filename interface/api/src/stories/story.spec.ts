import { describe, it, expect } from 'vitest';
import {
  formaterPrompt,
  lireBug,
  lirePrompt,
  lireStory,
  statutDepuis,
  titrePrompt,
  typeDepuis,
  verifierPrete,
  verifierPrompt,
} from './story.js';

const formulaireStory = (criteres: string) =>
  [
    '### En tant que',
    '',
    "agent d'accueil",
    '',
    '### Je veux',
    '',
    'voir les salles libres',
    '',
    '### Afin de',
    '',
    'proposer une salle',
    '',
    "### Critères d'acceptation",
    '',
    criteres,
  ].join('\n');

const formulaireBug = [
  '### Ce qui se passe',
  '',
  'Aucune salle le lundi',
  '',
  '### Ce qui devrait se passer',
  '',
  'Les salles libres',
  '',
  '### Comment le reproduire',
  '',
  '1. Ouvrir la liste un lundi',
  '',
  '### Écran ou adresse concerné',
  '',
  '_No response_',
].join('\n');

describe('Lecture des issues écrites dans GitHub', () => {
  it('relit une story saisie avec le formulaire user-story.yml', () => {
    expect(lireStory(formulaireStory('- une salle sans réservation est libre\n- triées par nom'))).toEqual({
      role: "agent d'accueil",
      besoin: 'voir les salles libres',
      benefice: 'proposer une salle',
      criteres: ['une salle sans réservation est libre', 'triées par nom'],
    });
  });

  it('relit un problème saisi avec le formulaire bug.yml, champ facultatif vide', () => {
    expect(lireBug(formulaireBug)).toEqual({
      constate: 'Aucune salle le lundi',
      attendu: 'Les salles libres',
      etapes: '1. Ouvrir la liste un lundi',
      ecran: '',
    });
  });

  it('ne reconnaît pas une issue écrite librement', () => {
    expect(lireStory('Il faudrait une page d’accueil')).toBeNull();
    expect(lireBug('Ça ne marche pas')).toBeNull();
  });
});

describe('Une demande est-elle prête à être lancée ?', () => {
  it('oui : story complète, 4 critères au plus', () => {
    expect(verifierPrete('story', lireStory(formulaireStory('- a\n- b\n- c\n- d')), null)).toEqual({ prete: true });
  });

  it('non : plus de 4 critères, il faut la découper sur GitHub', () => {
    const resultat = verifierPrete('story', lireStory(formulaireStory('- a\n- b\n- c\n- d\n- e')), null);
    expect(resultat).toEqual({ prete: false, raison: expect.stringMatching(/Plus de 4 critères/) });
  });

  it('non : aucun critère', () => {
    expect(verifierPrete('story', lireStory(formulaireStory('')), null)).toEqual({
      prete: false,
      raison: 'Aucun critère d’acceptation',
    });
  });

  it('non : story écrite hors du formulaire', () => {
    expect(verifierPrete('story', null, null)).toEqual({ prete: false, raison: expect.stringMatching(/formulaire/) });
  });

  it('oui : problème complet ; non : sans étapes de reproduction', () => {
    expect(verifierPrete('bug', null, lireBug(formulaireBug))).toEqual({ prete: true });
    const sansEtapes = { ...lireBug(formulaireBug)!, etapes: '' };
    expect(verifierPrete('bug', null, sansEtapes)).toEqual({ prete: false, raison: expect.stringMatching(/reproduire/) });
  });
});

describe('Statut et type', () => {
  it('« livrée » quand l’issue est fermée, sinon le label de statut', () => {
    expect(statutDepuis('closed', ['story:en-cours'])).toBe('livree');
    expect(statutDepuis('open', ['user-story', 'story:questions'])).toBe('questions');
    expect(statutDepuis('open', ['user-story'])).toBe('nouvelle');
  });

  it('distingue un problème d’une story par son label', () => {
    expect(typeDepuis(['bug'])).toBe('bug');
    expect(typeDepuis(['user-story'])).toBe('story');
  });

  it('reconnaît une story ou un problème sans label, par le contenu du formulaire', () => {
    expect(typeDepuis([], formulaireStory('- a'))).toBe('story');
    expect(typeDepuis([], formulaireBug)).toBe('bug');
    expect(typeDepuis([], 'Une question libre')).toBeNull();
  });
});

describe('Mode sauvage : demande libre', () => {
  it('enregistre le prompt dans un format relisible, reconnu comme demande libre', () => {
    const corps = formaterPrompt('  Mets le titre de la page en bleu  ');
    expect(corps).toContain('### Demande libre (mode sauvage, hors story)');
    expect(lirePrompt(corps)).toBe('Mets le titre de la page en bleu');
    expect(typeDepuis([], corps)).toBe('libre');
    expect(typeDepuis(['mode-libre'], '')).toBe('libre');
    expect(verifierPrete('libre', null, null, lirePrompt(corps))).toEqual({ prete: true });
  });

  it('titre l’issue avec le début du prompt', () => {
    expect(titrePrompt('Ajoute un lien vers le guide dans le pied de page')).toBe(
      'Demande libre : Ajoute un lien vers le guide dans le pied de page',
    );
    expect(titrePrompt('a'.repeat(80)).length).toBeLessThanOrEqual('Demande libre : '.length + 72);
  });

  it('garde la première proposition du prompt, sans la couper au milieu d’un mot', () => {
    expect(
      titrePrompt('Ajoute un filtre par catégorie au-dessus de la liste du matériel : Tous, Ordinateurs, Vidéoprojecteurs, Casques. Le filtre « Tous » est choisi par défaut.'),
    ).toBe('Demande libre : Ajoute un filtre par catégorie au-dessus de la liste du matériel');
    expect(titrePrompt('Mets le titre en bleu. Et agrandis-le.')).toBe('Demande libre : Mets le titre en bleu');
    const long = titrePrompt(`Ajoute ${'un très long morceau de phrase '.repeat(5)}`);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/\s…$/);
    expect(long.length).toBeLessThanOrEqual('Demande libre : '.length + 72);
  });

  it('refuse un prompt vide ou démesuré (une application entière s’écrit en stories)', () => {
    expect(verifierPrompt('  ')).toEqual({ ok: false, erreur: 'Décrivez votre demande en une phrase au moins' });
    const long = verifierPrompt('x'.repeat(1001));
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.erreur).toMatch(/écrivez des stories/);
  });
});
