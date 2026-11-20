import { describe, it, expect } from 'vitest'
import { decouperPave, lireSegments, lireTexteRiche } from '../texte-riche'

describe('Mise en forme des messages d’ADA', () => {
  it('reconnaît intertitres, listes à puces et numérotées, paragraphes', () => {
    const blocs = lireTexteRiche(
      [
        '🤖 **Plan proposé**',
        '',
        'La demande est claire.',
        'Voici ce que je propose.',
        '',
        '**Ce qui va changer pour l’utilisateur**',
        '- Un bouton **Emprunter** sur chaque objet',
        '- Un message de confirmation',
        '',
        '## Comment je vérifie',
        '1. Un test par critère',
        '2. Un test d’accessibilité',
      ].join('\n'),
    )
    // Une ligne qui finit une phrase est un paragraphe à part, même sans ligne vide.
    expect(blocs.map((bloc) => bloc.type)).toEqual(['paragraphe', 'paragraphe', 'paragraphe', 'intertitre', 'liste', 'intertitre', 'liste'])
    expect(blocs[1]).toEqual({ type: 'paragraphe', segments: [{ texte: 'La demande est claire.' }] })
    expect(blocs[2]).toEqual({ type: 'paragraphe', segments: [{ texte: 'Voici ce que je propose.' }] })
    expect(blocs[3]).toEqual({ type: 'intertitre', segments: [{ texte: 'Ce qui va changer pour l’utilisateur' }] })
    expect(blocs[4]).toMatchObject({ ordonnee: false, elements: [[{ texte: 'Un bouton ' }, { texte: 'Emprunter', gras: true }, { texte: ' sur chaque objet' }], [{ texte: 'Un message de confirmation' }]] })
    expect(blocs[6]).toMatchObject({ ordonnee: true, elements: [[{ texte: 'Un test par critère' }], [{ texte: 'Un test d’accessibilité' }]] })
  })

  it('une phrase coupée sur deux lignes reste un seul paragraphe', () => {
    expect(lireTexteRiche('Le tirage au sort se fait\nune seule fois par édition.')).toEqual([
      { type: 'paragraphe', segments: [{ texte: 'Le tirage au sort se fait une seule fois par édition.' }] },
    ])
  })

  it('découpe un gros pavé entre deux phrases, jamais au milieu d’une phrase', () => {
    const pave = Array.from({ length: 8 }, (_, rang) => `Voici la phrase numéro ${rang + 1}, assez longue pour compter vraiment.`).join(' ')
    const blocs = lireTexteRiche(pave)
    expect(blocs.length).toBeGreaterThan(1)
    for (const bloc of blocs) {
      const texte = bloc.type === 'paragraphe' ? bloc.segments.map((segment) => segment.texte).join('') : ''
      expect(texte.length).toBeLessThanOrEqual(280)
      expect(texte).toMatch(/^Voici .*\.$/)
    }
    expect(decouperPave('Court.')).toEqual(['Court.'])
  })

  it('gras et code en ligne ; une étoile seule reste du texte', () => {
    expect(lireSegments('Voir `ada.json` et **ceci** * pas cela')).toEqual([
      { texte: 'Voir ' },
      { texte: 'ada.json', code: true },
      { texte: ' et ' },
      { texte: 'ceci', gras: true },
      { texte: ' * pas cela' },
    ])
  })

  it('ne produit jamais de HTML : une balise reste du texte', () => {
    expect(lireTexteRiche('<img src=x onerror=alert(1)>')).toEqual([
      { type: 'paragraphe', segments: [{ texte: '<img src=x onerror=alert(1)>' }] },
    ])
  })
})
