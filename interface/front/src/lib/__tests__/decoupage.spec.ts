import { describe, it, expect } from 'vitest'
import { lireDecoupage, lireStoriesParent, MARQUEUR_ASSISTANT, presenterMessage, type StoryProposee } from '../story'

const STORIES: StoryProposee[] = [
  { titre: 'Voir le matériel', role: 'agent', besoin: 'voir la liste', benefice: 'savoir', criteres: ['Liste'] },
  { titre: 'Emprunter', role: 'agent', besoin: 'emprunter', benefice: 'éviter Excel', criteres: ['Bouton'] },
]
const encoder = (valeur: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(valeur))))
const proposition = `${MARQUEUR_ASSISTANT}\n🤖 **Découpage proposé**\n\nTrop gros.\n\n**Stories proposées** (à choisir dans ADA) :\n1. **Voir le matériel** — …\n\n<!-- ada:decoupage ${encoder(STORIES)} -->`

describe('Découpage proposé (#36)', () => {
  it('lit les stories proposées, accents compris', () => {
    expect(lireDecoupage(proposition)).toEqual(STORIES)
    expect(lireDecoupage('rien')).toEqual([])
  })

  it('n’affiche dans le fil que l’explication (la proposition est dans le formulaire)', () => {
    expect(presenterMessage({ id: 1, auteur: 'robot', avatar: null, le: '', texte: proposition }).texte).toBe('🤖 **Découpage proposé**\n\nTrop gros.')
  })

  it('lit les stories d’une demande parent, livrées ou non', () => {
    const corps = '### Demande\n\nTout\n\n### Découpage\n\nDemande découpée en 2 stories.\n\n- [x] #7 Voir le matériel\n- [ ] #8 Emprunter\n'
    expect(lireStoriesParent(corps)).toEqual([
      { numero: 7, titre: 'Voir le matériel', livree: true },
      { numero: 8, titre: 'Emprunter', livree: false },
    ])
    expect(lireStoriesParent('### Demande\n\n- [ ] #3 pas une story du découpage')).toEqual([])
  })
})
