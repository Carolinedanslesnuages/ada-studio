import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { NOM_BALISE } from '@/composant'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

/** Le composant testé comme l'utilise un site hôte : la vraie balise, dans la page. */
async function integrer(attributs: Record<string, string> = {}) {
  const element = document.createElement(NOM_BALISE)
  const reglages = { elements: '["Lille","Lyon","Nantes"]', libelle: 'Rechercher une ville', ...attributs }
  for (const [nom, valeur] of Object.entries(reglages)) element.setAttribute(nom, valeur)
  document.body.appendChild(element)
  await nextTick()
  const racine = element.shadowRoot!
  return { element, racine, boutons: () => [...racine.querySelectorAll('li button')] as HTMLButtonElement[] }
}

const saisir = async (champ: HTMLInputElement, texte: string) => {
  champ.value = texte
  champ.dispatchEvent(new Event('input'))
  await nextTick()
}

describe('Composant à intégrer (balise réelle, Shadow DOM)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('affiche son titre, un champ étiqueté et tous les éléments', async () => {
    const { racine, boutons } = await integrer({ titre: 'Villes' })
    expect(racine.querySelector('h2')!.textContent).toBe('Villes')
    const champ = racine.querySelector('input')!
    expect(racine.querySelector(`label[for="${champ.id}"]`)!.textContent).toBe('Rechercher une ville')
    expect(boutons().map((bouton) => bouton.textContent!.trim())).toEqual(['Lille', 'Lyon', 'Nantes'])
  })

  it('filtre pendant la saisie et annonce le nombre de résultats', async () => {
    const { racine, boutons } = await integrer()
    await saisir(racine.querySelector('input')!, 'ly')
    expect(boutons().map((bouton) => bouton.textContent!.trim())).toEqual(['Lyon'])
    expect(racine.querySelector('[role="status"]')!.textContent).toBe('1 résultat')
    await saisir(racine.querySelector('input')!, 'paris')
    expect(racine.querySelector('[role="status"]')!.textContent).toBe('Aucun résultat')
  })

  it('prévient la page hôte du choix par un événement « choix », et le montre', async () => {
    const { element, boutons } = await integrer()
    const recus: unknown[] = []
    element.addEventListener('choix', (evenement) => recus.push((evenement as CustomEvent).detail))
    boutons()[1]!.click()
    await nextTick()
    expect(recus).toEqual([['Lyon']])
    expect(boutons()[1]!.getAttribute('aria-pressed')).toBe('true')
  })

  it('suit un changement d’attribut fait par la page hôte', async () => {
    const { element, boutons } = await integrer()
    element.setAttribute('elements', 'Brest; Quimper')
    await nextTick()
    expect(boutons().map((bouton) => bouton.textContent!.trim())).toEqual(['Brest', 'Quimper'])
  })

  it('aucune violation d’accessibilité automatique (Shadow DOM compris)', async () => {
    await integrer()
    expect(await violationsAccessibilite(document.body)).toEqual([])
  })
})
