/**
 * Mise en forme des messages de l'assistant (Markdown simple : intertitres, listes, gras, code),
 * sans jamais injecter de HTML : le texte est découpé en blocs rendus par des balises Vue, donc
 * échappé. Les intertitres deviennent du texte en gras (pas de h1-h6 : la hiérarchie de titres de
 * la page reste celle d'ADA).
 */
export type Segment = { texte: string; gras?: boolean; code?: boolean }
export type Bloc =
  | { type: 'intertitre'; segments: Segment[] }
  | { type: 'paragraphe'; segments: Segment[] }
  | { type: 'liste'; ordonnee: boolean; elements: Segment[][] }

/** **gras** et `code` en ligne. */
export function lireSegments(ligne: string): Segment[] {
  const segments: Segment[] = []
  const motif = /\*\*(.+?)\*\*|`([^`]+)`/g
  let position = 0
  for (const trouve of ligne.matchAll(motif)) {
    if (trouve.index > position) segments.push({ texte: ligne.slice(position, trouve.index) })
    if (trouve[1] !== undefined) segments.push({ texte: trouve[1], gras: true })
    else segments.push({ texte: trouve[2]!, code: true })
    position = trouve.index + trouve[0].length
  }
  if (position < ligne.length) segments.push({ texte: ligne.slice(position) })
  return segments
}

const PUCE = /^\s*[-*•]\s+(.*)$/
const NUMERO = /^\s*\d+[.)]\s+(.*)$/
const INTERTITRE = /^\s*#{1,6}\s+(.*)$/
const LIGNE_EN_GRAS = /^\s*\*\*([^*]+?)\*\*\s*:?\s*$/
/** Une ligne qui finit une phrase termine son paragraphe (l'assistant oublie parfois la ligne vide). */
const FIN_DE_PHRASE = /[.!?…:]\s*$/
/** Au-delà, un paragraphe est un pavé : il est découpé entre deux phrases. */
const PARAGRAPHE_MAX = 280

/** Découpe un paragraphe trop long en paragraphes de quelques phrases (jamais au milieu d'une phrase). */
export function decouperPave(texte: string, max = PARAGRAPHE_MAX): string[] {
  if (texte.length <= max) return [texte]
  const phrases = texte.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Ý0-9«"(])/)
  const morceaux: string[] = []
  for (const phrase of phrases) {
    const dernier = morceaux[morceaux.length - 1]
    if (dernier !== undefined && dernier.length + 1 + phrase.length <= max) morceaux[morceaux.length - 1] = `${dernier} ${phrase}`
    else morceaux.push(phrase)
  }
  return morceaux
}

export function lireTexteRiche(texte: string): Bloc[] {
  const blocs: Bloc[] = []
  let paragraphe: string[] = []
  const finirParagraphe = () => {
    for (const morceau of paragraphe.length ? decouperPave(paragraphe.join(' ')) : []) {
      blocs.push({ type: 'paragraphe', segments: lireSegments(morceau) })
    }
    paragraphe = []
  }
  for (const ligne of texte.replace(/\r\n/g, '\n').split('\n')) {
    const puce = PUCE.exec(ligne)
    const numero = puce ? null : NUMERO.exec(ligne)
    const intertitre = INTERTITRE.exec(ligne)
    if (puce || numero) {
      finirParagraphe()
      const ordonnee = Boolean(numero)
      const derniere = blocs[blocs.length - 1]
      const element = lireSegments((puce ?? numero)![1]!)
      if (derniere?.type === 'liste' && derniere.ordonnee === ordonnee) derniere.elements.push(element)
      else blocs.push({ type: 'liste', ordonnee, elements: [element] })
    } else if (intertitre) {
      finirParagraphe()
      blocs.push({ type: 'intertitre', segments: lireSegments(intertitre[1]!.replace(/^\*\*(.*)\*\*$/, '$1')) })
    } else if (LIGNE_EN_GRAS.test(ligne)) {
      // Ligne entièrement en gras : c'est un intertitre (« **Accessibilité** »).
      finirParagraphe()
      blocs.push({ type: 'intertitre', segments: [{ texte: LIGNE_EN_GRAS.exec(ligne)![1]! }] })
    } else if (!ligne.trim() || /^\s*-{3,}\s*$/.test(ligne)) {
      finirParagraphe()
    } else {
      paragraphe.push(ligne.trim())
      if (FIN_DE_PHRASE.test(ligne)) finirParagraphe()
    }
  }
  finirParagraphe()
  return blocs
}
