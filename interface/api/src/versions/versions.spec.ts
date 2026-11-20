import { describe, it, expect } from 'vitest';
import { lireRecapitulatif, peutPublier, versionDepuisTitre } from './versions.js';

const CORPS = `:robot: I have created a release *beep* *boop*
---


## [0.2.0](https://github.com/p/poc/compare/v0.1.0...v0.2.0) (2026-11-16)


### Features

* AJOUTER LE NOM DU SERVICE ([#5](https://github.com/p/poc/issues/5)) ([2657aec](https://github.com/p/poc/commit/2657aec)), closes [#2](https://github.com/p/poc/issues/2)
* Page d'accueil ([#3](https://github.com/p/poc/issues/3)) ([c4a7c4c](https://github.com/p/poc/commit/c4a7c4c)), closes [#1](https://github.com/p/poc/issues/1)


### Bug Fixes

* **accueil:** la date s’affiche en français ([#7](https://github.com/p/poc/issues/7)) ([abc1234](https://github.com/p/poc/commit/abc1234))

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please).`;

describe('Récapitulatif d’une version', () => {
  it('lit le numéro de version proposé', () => {
    expect(versionDepuisTitre('chore(main): release 0.2.0')).toBe('0.2.0');
    expect(versionDepuisTitre('autre chose')).toBeNull();
  });

  it('présente les nouveautés et les corrections en clair, avec la demande livrée', () => {
    expect(lireRecapitulatif('chore(main): release 0.2.0', CORPS)).toEqual({
      version: '0.2.0',
      nouveautes: [
        { texte: 'AJOUTER LE NOM DU SERVICE', demande: 2 },
        { texte: 'Page d\'accueil', demande: 1 },
      ],
      corrections: [{ texte: 'accueil: la date s’affiche en français', demande: null }],
      autres: [],
    });
  });
});

describe('Peut-on publier ?', () => {
  it('oui si la PR ne touche que les fichiers de version', () => {
    expect(peutPublier(['.release-please-manifest.json', 'CHANGELOG.md', 'version.txt'])).toEqual({ publiable: true, raison: null });
  });

  it('non si elle touche du code : un développeur doit regarder', () => {
    const resultat = peutPublier(['CHANGELOG.md', 'front/src/App.vue']);
    expect(resultat.publiable).toBe(false);
    expect(resultat.raison).toContain('front/src/App.vue');
  });
});
