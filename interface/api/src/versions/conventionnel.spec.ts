import { describe, it, expect } from 'vitest';
import { estTitreConventionnel } from './conventionnel.js';

describe('Titre Conventional Commits (décide de la version semver)', () => {
  it.each([
    'feat: AVOIR UNE BAR DE RECHERCHE',
    'fix: le bouton Envoyer reste actif',
    'feat(accueil): carte des applications',
    'feat!: nouveau format des réservations',
    'fix(sécurité): l’agent ne modifie plus .github/',
    'chore(main): release 0.2.0',
  ])('accepte « %s »', (titre) => {
    expect(estTitreConventionnel(titre)).toBe(true);
  });

  it.each([
    'Merge pull request #6 from x/y',
    'Initial commit',
    'Revert "chore: baseline"',
    'feature: page',
    'feat:collé',
    'feat: ',
    'Feat: majuscule',
    'feat(): portée vide',
  ])('refuse « %s »', (titre) => {
    expect(estTitreConventionnel(titre)).toBe(false);
  });
});
