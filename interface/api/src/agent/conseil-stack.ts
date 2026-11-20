import type { Modele } from '../projets/modeles.js';

/**
 * Conseil de stack à la création (#68) : l'assistant lit l'idée du PO et choisit, parmi les
 * modèles livrés, celui qui convient le mieux. Il ne fait que répondre : aucun outil, aucun fichier.
 */
export interface ConseilStack {
  modele: string;
  /** Une phrase, en langage métier, qui explique le choix au PO. */
  raison: string;
}

/** Outils refusés à l'assistant pendant le conseil : il lit l'idée et répond, rien d'autre. */
export const OUTILS_CONSEIL_INTERDITS = ['Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'NotebookEdit', 'Task'];

export function consigneConseilStack(idee: string, modeles: Pick<Modele, 'id' | 'type' | 'libelle' | 'pourQuoi'>[], types: { id: string; libelle: string; description: string }[]): string {
  const libelleType = (id: string) => types.find((type) => type.id === id)?.libelle ?? id;
  const catalogue = modeles.map((modele) => `- ${modele.id} : ${libelleType(modele.type)} — ${modele.libelle} (${modele.pourQuoi})`).join('\n');
  return `Tu conseilles un Product Owner, qui n'est pas développeur, au moment de créer son projet.
Voici son idée, telle qu'il l'a racontée (elle peut être courte ou désordonnée) :
"""
${idee}
"""

Choisis le modèle de projet le plus adapté, UNIQUEMENT parmi cette liste (identifiant : description) :
${catalogue}

Réponds UNIQUEMENT par un objet JSON, sans texte autour :
{"modele": "<identifiant exact de la liste>", "raison": "<une seule phrase courte (25 mots au maximum), en français simple et sans jargon, qui explique ce choix au PO>"}
N'utilise aucun outil. N'invente aucun identifiant.`;
}

/** Coupe un texte trop long à la fin d'une phrase, sinon d'un mot (jamais au milieu d'un mot). */
function couper(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const debut = texte.slice(0, max);
  const finPhrase = Math.max(debut.lastIndexOf('. '), debut.lastIndexOf('! '), debut.lastIndexOf('? '));
  if (finPhrase > max / 2) return debut.slice(0, finPhrase + 1);
  return `${debut.slice(0, debut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

/** Lit la réponse de l'assistant ; null si elle est illisible ou propose un modèle hors liste. */
export function lireConseilStack(reponse: string, identifiants: string[]): ConseilStack | null {
  const json = reponse.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const { modele, raison } = JSON.parse(json) as { modele?: unknown; raison?: unknown };
    if (typeof modele !== 'string' || !identifiants.includes(modele)) return null;
    return { modele, raison: typeof raison === 'string' ? couper(raison.replace(/\s+/g, ' ').trim(), 300) : '' };
  } catch {
    return null;
  }
}
