import axe from 'axe-core'

/**
 * Pilotage à la voix (Commande vocale de macOS, Accès vocal de Windows, Dragon) : la personne
 * prononce ce qu'elle lit (« Cliquer Envoyer »). Chaque bouton et chaque lien doit donc porter un
 * intitulé VISIBLE, pas seulement une icône avec un nom caché.
 */
function sansIntituleVisible(element: Element): string[] {
  const cibles = [...element.querySelectorAll('button, a[href], [role="button"]')]
  return cibles
    .filter((cible) => {
      const copie = cible.cloneNode(true) as Element
      copie.querySelectorAll('.visuellement-cache, [aria-hidden="true"]').forEach((cache) => cache.remove())
      return !(copie.textContent ?? '').trim()
    })
    .map((cible) => `intitule-visible — Bouton ou lien sans intitulé visible, impossible à nommer à la voix : ${cible.outerHTML.slice(0, 120)}`)
}

/** axe-core, WCAG 2.1 A/AA (base du RGAA 4). Couvre environ un tiers des critères. */
export async function violationsAccessibilite(element: Element): Promise<string[]> {
  const resultat = await axe.run(element, {
    // Le contenu d'un cadre (l'aperçu du projet) est l'application du PO : auditée par ses propres tests.
    iframes: false,
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } }, // non mesurable sous jsdom
  })
  // WCAG 2.5.3 (étiquette dans le nom) : le nom prononcé doit contenir l'intitulé visible.
  const voix = await axe.run(element, { iframes: false, runOnly: { type: 'rule', values: ['label-content-name-mismatch'] } })
  return [...resultat.violations, ...voix.violations]
    .map((v) => `${v.id} — ${v.help} (${v.nodes.length}) : ${v.helpUrl}`)
    .concat(sansIntituleVisible(element))
}
