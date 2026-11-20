/** Empreinte carbone estimée de l'usage d'ADA (calcul côté API : méthode EcoLogits, équivalents ADEME). */
export interface Fourchette {
  min: number
  max: number
}

export interface Empreinte {
  energieWh: Fourchette
  co2g: Fourchette
  tokensSortie: number
  tokensEntree: number
}

/** Équivalents de l'ADEME (Impact CO2), en g CO2e ; `ampouleLedW` est une hypothèse d'ADA (en watts). */
export interface Equivalents {
  streamingHeureG: number
  voitureKmG: number
  rechercheWebG: number
  tgvAllerRetourParisMarseilleG: number
  avionAllerRetourParisNewYorkG: number
  ampouleLedW: number
}

export interface EmpreinteAda {
  total: Empreinte
  parProjet: { projet: string; empreinte: Empreinte }[]
  depuis: string | null
  equivalents: Equivalents
  hypotheses: {
    electriciteGCo2ParKwh: number
    modeles: Record<string, { totalMilliards: number; actifsMilliards: Fourchette; source: string }>
  }
}

const nombre = (valeur: number, decimales = 0) =>
  valeur.toLocaleString('fr-FR', { maximumFractionDigits: decimales, minimumFractionDigits: 0 })

/** Deux chiffres significatifs suffisent : c'est une estimation. */
const arrondi = (valeur: number) => (valeur >= 100 ? Math.round(valeur) : valeur >= 10 ? Math.round(valeur) : Number(valeur.toPrecision(2)))

function fourchette(f: Fourchette, unite: string, diviseur = 1): string {
  const min = arrondi(f.min / diviseur)
  const max = arrondi(f.max / diviseur)
  return min === max ? `${nombre(min, 2)} ${unite}` : `${nombre(min, 2)} à ${nombre(max, 2)} ${unite}`
}

export function formaterCo2(f: Fourchette): string {
  return f.max >= 1000 ? fourchette(f, 'kg CO2e', 1000) : fourchette(f, 'g CO2e')
}

export function formaterEnergie(f: Fourchette): string {
  return f.max >= 1000 ? fourchette(f, 'kWh', 1000) : fourchette(f, 'Wh')
}

/** Heures de streaming vidéo (ADEME, Impact CO2) : en minutes en dessous d'une heure. */
export function enStreaming(co2g: Fourchette, gParHeure: number): string {
  const heures = { min: co2g.min / gParHeure, max: co2g.max / gParHeure }
  return heures.max < 1
    ? `${fourchette({ min: heures.min * 60, max: heures.max * 60 }, 'min')} de streaming vidéo`
    : `${fourchette(heures, 'h')} de streaming vidéo`
}

/** Distance en voiture thermique (ADEME, Impact CO2) : en mètres en dessous d'un kilomètre. */
export function enVoiture(co2g: Fourchette, gParKm: number): string {
  const km = { min: co2g.min / gParKm, max: co2g.max / gParKm }
  return km.max < 1 ? `${fourchette({ min: km.min * 1000, max: km.max * 1000 }, 'm')} en voiture thermique` : `${fourchette(km, 'km')} en voiture thermique`
}

/** Recherches web (ADEME, Impact CO2) : pour les tout petits totaux. */
export function enRecherchesWeb(co2g: Fourchette, gParRecherche: number): string {
  const fois = { min: co2g.min / gParRecherche, max: co2g.max / gParRecherche }
  return `${fourchette(fois, fois.max < 2 ? 'recherche web' : 'recherches web')}`
}

/** Allers-retours Paris–Marseille en TGV (ADEME, cas pratique d'Impact CO2). */
export function enTgv(co2g: Fourchette, gAllerRetour: number): string {
  const trajets = { min: co2g.min / gAllerRetour, max: co2g.max / gAllerRetour }
  return `${fourchette(trajets, 'aller-retour Paris–Marseille en TGV')}`
}

/** Allers-retours Paris–New York en avion (ADEME, cas pratique d'Impact CO2) : en pourcentage sous un trajet. */
export function enAvion(co2g: Fourchette, gAllerRetour: number): string {
  const trajets = { min: co2g.min / gAllerRetour, max: co2g.max / gAllerRetour }
  return trajets.max < 1
    ? fourchette({ min: trajets.min * 100, max: trajets.max * 100 }, '% d’un aller-retour Paris–New York en avion')
    : fourchette(trajets, 'aller-retour Paris–New York en avion')
}

/** Une ampoule LED allumée : traduit une ÉNERGIE (pas du CO2), avec la puissance supposée par ADA. */
export function enAmpoule(energieWh: Fourchette, watts: number): string {
  const heures = { min: energieWh.min / watts, max: energieWh.max / watts }
  const duree = heures.max < 1 ? fourchette({ min: heures.min * 60, max: heures.max * 60 }, 'min') : fourchette(heures, 'h')
  return `une ampoule LED de ${watts} W allumée ${duree}`
}

/**
 * Deux équivalents qui parlent, choisis selon l'ordre de grandeur du total (un « 0,0001 aller-retour
 * en avion » ne dirait rien) : de quelques grammes à plusieurs kilos, la comparaison change d'échelle.
 */
export function equivalentsParlants(co2g: Fourchette, eq: Equivalents): [string, string] {
  const milieu = (co2g.min + co2g.max) / 2
  if (milieu < 20) return [enRecherchesWeb(co2g, eq.rechercheWebG), enStreaming(co2g, eq.streamingHeureG)]
  if (milieu < 1000) return [enStreaming(co2g, eq.streamingHeureG), enVoiture(co2g, eq.voitureKmG)]
  if (milieu < 100_000) return [enVoiture(co2g, eq.voitureKmG), enTgv(co2g, eq.tgvAllerRetourParisMarseilleG)]
  return [enTgv(co2g, eq.tgvAllerRetourParisMarseilleG), enAvion(co2g, eq.avionAllerRetourParisNewYorkG)]
}
