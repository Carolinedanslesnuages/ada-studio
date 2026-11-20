/**
 * Empreinte carbone de l'usage d'ADA (inférence des modèles), estimée en FOURCHETTE.
 *
 * Méthode : EcoLogits (GenAI Impact), méthode ouverte d'analyse de cycle de vie, qui s'appuie sur la
 * Base Empreinte de l'ADEME : https://ecologits.ai/latest/methodology/llm_inference/
 * Équivalents : Impact CO2 (ADEME), https://impactco2.fr (API publique, valeurs du 2026-11-18).
 *
 * Limites, à afficher avec le chiffre :
 * - Anthropic ne publie ni la taille de ses modèles ni leur consommation : les tailles ci-dessous
 *   sont des HYPOTHÈSES (estimation d'EcoLogits pour Claude 3 Opus), à remplacer quand on saura ;
 * - comme EcoLogits, seuls les tokens PRODUITS comptent ; la lecture (contexte, cache) n'est pas
 *   comptée : c'est une borne basse pour un agent qui relit beaucoup ;
 * - l'entraînement des modèles et le poste de travail ne sont pas comptés.
 * Les calculs sont refaits à chaque affichage depuis le journal brut (tokens par modèle) :
 * améliorer une hypothèse corrige tout l'historique.
 */

/** Un usage relevé à la fin d'une exécution de l'agent : tokens par modèle (rapport de Claude). */
export interface UsageModele {
  modele: string;
  tokensEntree: number;
  tokensSortie: number;
}

export interface Fourchette {
  min: number;
  max: number;
}

export interface Empreinte {
  /** Énergie consommée, en Wh. */
  energieWh: Fourchette;
  /** Émissions, en g CO2e (électricité + part de la fabrication des serveurs). */
  co2g: Fourchette;
  tokensSortie: number;
  tokensEntree: number;
}

interface HypotheseModele {
  /** Paramètres totaux (milliards) : fixe le nombre de GPU nécessaires. */
  totalMilliards: number;
  /** Paramètres actifs par token (milliards), fourchette (modèle à experts, 10 à 30 % actifs). */
  actifsMilliards: Fourchette;
  source: string;
}

/**
 * Tailles supposées des familles Claude. Seule Opus a une estimation publiée (EcoLogits, Claude 3
 * Opus : ~2 000 milliards, 200 à 600 actifs) ; Sonnet et Haiku sont des hypothèses d'ADA, plus
 * petites, à remplacer dès qu'une estimation sourcée existe.
 */
export const HYPOTHESES_MODELES: Record<'opus' | 'sonnet' | 'haiku', HypotheseModele> = {
  opus: { totalMilliards: 2000, actifsMilliards: { min: 200, max: 600 }, source: 'EcoLogits, estimation pour Claude 3 Opus' },
  sonnet: { totalMilliards: 1000, actifsMilliards: { min: 100, max: 300 }, source: 'hypothèse ADA (moitié d’Opus)' },
  haiku: { totalMilliards: 300, actifsMilliards: { min: 30, max: 90 }, source: 'hypothèse ADA' },
};

/** Constantes d'EcoLogits (méthodologie « LLM inference »). */
const ECOLOGITS = {
  alpha: 1.17e-6,
  beta: -1.12e-2,
  gamma: 4.05e-5,
  batch: 64,
  puissanceServeurHorsGpuW: 1200,
  gpuParServeur: 8,
  memoireGpuGo: 80,
  surcoutMemoire: 1.2,
  octetsParParametre: 2,
  /** PUE des centres de données utilisés par Anthropic (AWS, Google), d'après EcoLogits. */
  pue: { min: 1.09, max: 1.14 },
  /** Fabrication : serveur sans GPU (kg CO2e), GPU H100, durée de vie (ans). */
  fabricationServeurKg: 5700,
  fabricationGpuKg: 273,
  dureeVieAns: 3,
};

/** Hypothèse d'ADA : débit de génération, pour la durée d'occupation des serveurs. */
const TOKENS_PAR_SECONDE = 40;

/** Électricité aux États-Unis (centres de données d'Anthropic) : Ember 2024, source d'Our World in Data. */
export const G_CO2_PAR_KWH = 384;

/**
 * Équivalents officiels de l'ADEME (Impact CO2, cycle de vie complet, valeurs relues le 2026-11-19),
 * sauf `ampouleLedW`, hypothèse d'ADA (pas de l'ADEME) : une puissance, pour traduire une énergie.
 */
export const EQUIVALENTS = {
  /** Une heure de streaming vidéo (thématique « Usage numérique »). */
  streamingHeureG: 64,
  /** Un kilomètre en voiture thermique (thématique « Transport »). */
  voitureKmG: 142.25,
  /** Une recherche web (thématique « Usage numérique »). */
  rechercheWebG: 1.23,
  /** Un aller-retour Paris–Marseille en TGV (« Cas pratiques »). */
  tgvAllerRetourParisMarseilleG: 4400,
  /** Un aller-retour Paris–New York en avion, par personne (« Cas pratiques »). */
  avionAllerRetourParisNewYorkG: 2_060_000,
  /** Hypothèse d'ADA : puissance d'une ampoule LED, pour dire « une ampoule allumée pendant… ». */
  ampouleLedW: 10,
};

function hypothese(modele: string): HypotheseModele {
  const nom = modele.toLowerCase();
  if (nom.includes('haiku')) return HYPOTHESES_MODELES.haiku;
  if (nom.includes('sonnet')) return HYPOTHESES_MODELES.sonnet;
  // Opus, et tout modèle inconnu : la plus prudente (la plus grande).
  return HYPOTHESES_MODELES.opus;
}

function nombreGpu(totalMilliards: number): number {
  const memoireGo = ECOLOGITS.surcoutMemoire * totalMilliards * ECOLOGITS.octetsParParametre;
  const brut = Math.ceil(memoireGo / ECOLOGITS.memoireGpuGo);
  return 2 ** Math.ceil(Math.log2(Math.max(1, brut)));
}

/** Énergie (Wh) et CO2e (g) pour des tokens produits, avec une taille active et un PUE donnés. */
function calculer(tokensSortie: number, h: HypotheseModele, actifs: number, pue: number): { wh: number; g: number } {
  const gpu = nombreGpu(h.totalMilliards);
  const whParTokenParGpu = ECOLOGITS.alpha * Math.exp(ECOLOGITS.beta * ECOLOGITS.batch) * actifs + ECOLOGITS.gamma;
  const energieGpu = tokensSortie * whParTokenParGpu * gpu;
  const dureeHeures = tokensSortie / TOKENS_PAR_SECONDE / 3600;
  const energieHorsGpu = (dureeHeures * ECOLOGITS.puissanceServeurHorsGpuW * (gpu / ECOLOGITS.gpuParServeur)) / ECOLOGITS.batch;
  const wh = pue * (energieGpu + energieHorsGpu);
  const fabricationKg = (gpu / ECOLOGITS.gpuParServeur) * ECOLOGITS.fabricationServeurKg + gpu * ECOLOGITS.fabricationGpuKg;
  const partFabrication = dureeHeures / (ECOLOGITS.batch * ECOLOGITS.dureeVieAns * 365 * 24);
  return { wh, g: (wh / 1000) * G_CO2_PAR_KWH + partFabrication * fabricationKg * 1000 };
}

export function empreinte(usages: UsageModele[]): Empreinte {
  const total: Empreinte = { energieWh: { min: 0, max: 0 }, co2g: { min: 0, max: 0 }, tokensSortie: 0, tokensEntree: 0 };
  for (const usage of usages) {
    const h = hypothese(usage.modele);
    const bas = calculer(usage.tokensSortie, h, h.actifsMilliards.min, ECOLOGITS.pue.min);
    const haut = calculer(usage.tokensSortie, h, h.actifsMilliards.max, ECOLOGITS.pue.max);
    total.energieWh.min += bas.wh;
    total.energieWh.max += haut.wh;
    total.co2g.min += bas.g;
    total.co2g.max += haut.g;
    total.tokensSortie += usage.tokensSortie;
    total.tokensEntree += usage.tokensEntree;
  }
  return total;
}

/** Usages par modèle, lus dans l'événement « result » de Claude (champ modelUsage). */
export function lireUsages(modelUsage: unknown): UsageModele[] {
  if (!modelUsage || typeof modelUsage !== 'object') return [];
  return Object.entries(modelUsage as Record<string, Record<string, unknown>>).map(([modele, u]) => ({
    modele,
    tokensEntree: ['inputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'].reduce((somme, cle) => somme + (Number(u?.[cle]) || 0), 0),
    tokensSortie: Number(u?.outputTokens) || 0,
  }));
}
