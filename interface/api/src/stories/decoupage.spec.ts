import { describe, it, expect } from 'vitest';
import {
  ajouterDecoupage,
  cocherEnfant,
  formaterStory,
  lireDecoupage,
  lireParent,
  lireStory,
  nettoyerStoriesProposees,
  texteDecoupage,
  type StoryProposee,
} from './story.js';

const STORY: StoryProposee = { titre: 'Voir le matériel', role: 'agent', besoin: 'voir la liste', benefice: 'savoir quoi emprunter', criteres: ['Liste du matériel'] };
const AUTRE: StoryProposee = { ...STORY, titre: 'Emprunter', besoin: 'emprunter un objet' };

describe('Découpage d’une demande en stories (#36)', () => {
  it('ne garde que des stories complètes (2 à 8, 1 à 4 critères)', () => {
    expect(nettoyerStoriesProposees([STORY, AUTRE])).toEqual([STORY, AUTRE]);
    expect(nettoyerStoriesProposees([STORY])).toEqual([]);
    expect(nettoyerStoriesProposees([STORY, { ...AUTRE, criteres: [] }])).toEqual([]);
    expect(nettoyerStoriesProposees([STORY, { ...AUTRE, criteres: ['a', 'b', 'c', 'd', 'e'] }])[1]!.criteres).toHaveLength(4);
    expect(nettoyerStoriesProposees(Array.from({ length: 10 }, () => STORY))).toHaveLength(8);
  });

  it('écrit la proposition lisible sur GitHub et la relit à l’identique', () => {
    const texte = texteDecoupage('Trop gros pour une seule story.', [STORY, AUTRE]);
    expect(texte).toContain('1. **Voir le matériel** — en tant que agent, je veux voir la liste, afin de savoir quoi emprunter.');
    expect(lireDecoupage(texte)).toEqual([STORY, AUTRE]);
    expect(lireDecoupage('sans proposition')).toEqual([]);
  });

  it('signale sur GitHub la story qui recoupe une story existante, et garde l’information à la relecture', () => {
    const texte = texteDecoupage('Trop gros.', [STORY, { ...AUTRE, doublonDe: 31 }]);
    expect(texte).toContain('2. **Emprunter** _(recoupe #31, déjà dans le projet)_');
    expect(lireDecoupage(texte)[1]!.doublonDe).toBe(31);
  });

  it('crée une story au format du formulaire, qui renvoie à sa demande parent', () => {
    const corps = formaterStory(STORY, 4);
    expect(lireStory(corps)).toEqual({ role: 'agent', besoin: 'voir la liste', benefice: 'savoir quoi emprunter', criteres: ['Liste du matériel'] });
    expect(lireParent(corps)).toBe(4);
    expect(lireParent('### En tant que\n\nagent')).toBeNull();
  });

  it('la demande parent liste ses stories en cases, cochées une à une jusqu’à la dernière', () => {
    const corps = ajouterDecoupage('### Demande\n\nTout le prêt de matériel', [
      { numero: 7, titre: 'Voir le matériel' },
      { numero: 8, titre: 'Emprunter' },
    ]);
    expect(corps).toContain('- [ ] #7 Voir le matériel\n- [ ] #8 Emprunter');
    const premiere = cocherEnfant(corps, 7);
    expect(premiere.corps).toContain('- [x] #7 Voir le matériel\n- [ ] #8 Emprunter');
    expect(premiere.toutesLivrees).toBe(false);
    expect(cocherEnfant(premiere.corps, 8).toutesLivrees).toBe(true);
    expect(cocherEnfant(corps, 70).corps).toBe(corps);
  });
});
