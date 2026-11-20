import { describe, it, expect } from 'vitest'
import { annonceResultats, lireElements, rechercher } from '../recherche'

describe('Règles du composant', () => {
  it('lit la liste en JSON ou séparée par des points-virgules, sans éléments vides', () => {
    expect(lireElements('["Lyon", " Lille ", ""]')).toEqual(['Lyon', 'Lille'])
    expect(lireElements('Lyon; Lille;;Nantes')).toEqual(['Lyon', 'Lille', 'Nantes'])
    expect(lireElements('')).toEqual([])
    expect(lireElements('{"pas":"une liste"}')).toEqual(['{"pas":"une liste"}'])
  })

  it('cherche sans tenir compte des accents ni des majuscules', () => {
    expect(rechercher(['Élève', 'Professeur'], 'eleve')).toEqual(['Élève'])
    expect(rechercher(['Lyon', 'Lille'], '  ')).toEqual(['Lyon', 'Lille'])
  })

  it('annonce le nombre de résultats en toutes lettres', () => {
    expect(annonceResultats(0)).toBe('Aucun résultat')
    expect(annonceResultats(1)).toBe('1 résultat')
    expect(annonceResultats(3)).toBe('3 résultats')
  })
})
