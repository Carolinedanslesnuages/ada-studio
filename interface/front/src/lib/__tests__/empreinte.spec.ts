import { describe, expect, it } from 'vitest'
import { enAmpoule, enAvion, equivalentsParlants, type Equivalents } from '../empreinte'

const EQ: Equivalents = {
  streamingHeureG: 64,
  voitureKmG: 142.25,
  rechercheWebG: 1.23,
  tgvAllerRetourParisMarseilleG: 4400,
  avionAllerRetourParisNewYorkG: 2_060_000,
  ampouleLedW: 10,
}

describe('équivalents de l’empreinte', () => {
  it('quelques grammes : recherches web et minutes de streaming', () => {
    const [premier, second] = equivalentsParlants({ min: 1.5, max: 4 }, EQ)
    expect(premier).toContain('recherche')
    expect(second).toContain('min de streaming vidéo')
  })

  it('quelques dizaines de grammes : streaming et voiture', () => {
    const [premier, second] = equivalentsParlants({ min: 48, max: 115 }, EQ)
    expect(premier).toContain('h de streaming vidéo')
    expect(second).toContain('en voiture thermique')
  })

  it('quelques kilos : voiture et TGV', () => {
    const [premier, second] = equivalentsParlants({ min: 3000, max: 8000 }, EQ)
    expect(premier).toContain('km en voiture thermique')
    expect(second).toContain('aller-retour Paris–Marseille en TGV')
  })

  it('plus de cent kilos : TGV, puis l’avion en pourcentage d’un aller-retour', () => {
    const [premier, second] = equivalentsParlants({ min: 120_000, max: 300_000 }, EQ)
    expect(premier).toContain('en TGV')
    expect(second).toBe('5,8 à 15 % d’un aller-retour Paris–New York en avion')
  })

  it('l’avion passe en nombre d’allers-retours au-delà d’un trajet', () => {
    expect(enAvion({ min: 2_060_000, max: 4_120_000 }, EQ.avionAllerRetourParisNewYorkG)).toBe('1 à 2 aller-retour Paris–New York en avion')
  })

  it('l’ampoule traduit l’énergie, avec sa puissance supposée', () => {
    expect(enAmpoule({ min: 12, max: 29 }, 10)).toBe('une ampoule LED de 10 W allumée 1,2 à 2,9 h')
    expect(enAmpoule({ min: 2, max: 5 }, 10)).toBe('une ampoule LED de 10 W allumée 12 à 30 min')
  })
})
