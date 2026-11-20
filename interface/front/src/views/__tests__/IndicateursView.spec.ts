import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Ui from '@/components/ui'
import IndicateursView from '../IndicateursView.vue'
import { api, ErreurApi } from '@/services/api'
import { duree, type Indicateurs } from '@/lib/indicateurs'
import type { EmpreinteAda } from '@/lib/empreinte'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

vi.mock('@/services/api', async (original) => ({
  ...(await original<typeof import('@/services/api')>()),
  api: { lire: vi.fn<(chemin: string) => Promise<unknown>>(), envoyer: vi.fn<(chemin: string, corps: unknown) => Promise<unknown>>() },
}))
const lire = vi.mocked(api.lire)

const INDICATEURS: Indicateurs = {
  projets: 2,
  historique: { total: 6, crees: 5, repris: 1, actifs: 2, archives: 0, retires: 0, supprimes: 4 },
  storiesLivrees: 5,
  dureeMoyenneMinutes: 25,
  parProjet: [
    { nom: 'pret-de-materiel', storiesLivrees: 5, dureeMoyenneMinutes: 25 },
    { nom: 'annuaire', storiesLivrees: 0, dureeMoyenneMinutes: null },
  ],
}

const EMPREINTE: EmpreinteAda = {
  total: { energieWh: { min: 120, max: 290 }, co2g: { min: 48, max: 115 }, tokensSortie: 10000, tokensEntree: 500000 },
  parProjet: [
    { projet: 'gladys', empreinte: { energieWh: { min: 100, max: 240 }, co2g: { min: 40, max: 95 }, tokensSortie: 8000, tokensEntree: 400000 } },
    { projet: 'secret-santa', empreinte: { energieWh: { min: 20, max: 50 }, co2g: { min: 8, max: 20 }, tokensSortie: 2000, tokensEntree: 100000 } },
  ],
  depuis: '2026-11-18T10:00:00Z',
  equivalents: {
    streamingHeureG: 64,
    voitureKmG: 142.25,
    rechercheWebG: 1.23,
    tgvAllerRetourParisMarseilleG: 4400,
    avionAllerRetourParisNewYorkG: 2_060_000,
    ampouleLedW: 10,
  },
  hypotheses: { electriciteGCo2ParKwh: 384, modeles: { opus: { totalMilliards: 2000, actifsMilliards: { min: 200, max: 600 }, source: 'EcoLogits, estimation pour Claude 3 Opus' } } },
}

const monter = async () => {
  const wrapper = mount(IndicateursView, { global: { plugins: [Ui] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('Page « Indicateurs »', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('compte tous les projets passés par ADA, y compris archivés, retirés et supprimés', async () => {
    lire.mockImplementation(async (chemin: string) => (chemin === '/indicateurs/empreinte' ? EMPREINTE : INDICATEURS))
    const wrapper = await monter()
    const texte = wrapper.text()
    expect(texte).toContain('Ce que sont devenus les projets')
    expect(texte).toContain('6 projets passés par ADA : 5 créés avec ADA, 1 repris')
    const legende = wrapper.findAll('.legende li').map((ligne) => ligne.text().replace(/\s+/g, ' '))
    expect(legende).toEqual(['2 Actifs dans ADA', '0 Archivés', '0 Retirés d’ADA (reprise annulée, désynchronisés)', '4 Supprimés de GitHub'])
    // La barre colorée est décorative : la légende donne les mêmes chiffres en texte.
    expect(wrapper.find('.devenir').attributes('aria-hidden')).toBe('true')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('montre projets, stories livrées et temps moyen, sur l’ensemble', async () => {
    lire.mockImplementation(async (chemin: string) => (chemin === '/indicateurs/empreinte' ? EMPREINTE : INDICATEURS))
    const wrapper = await monter()
    expect(lire).toHaveBeenCalledWith('/indicateurs')
    const cartes = wrapper.findAll('.chiffres li').map((carte) => carte.findAll('p').map((ligne) => ligne.text()))
    expect(cartes).toEqual([
      ['6', 'Projets passés par ADA'],
      ['2', 'Projets actifs dans ADA'],
      ['5', 'Stories livrées'],
      ['25 min', 'Temps moyen du lancement à la livraison'],
    ])
    wrapper.unmount()
  })

  it('détaille par projet, dans un tableau titré', async () => {
    lire.mockImplementation(async (chemin: string) => (chemin === '/indicateurs/empreinte' ? EMPREINTE : INDICATEURS))
    const wrapper = await monter()
    const tableau = wrapper.findAll('table').find((element) => element.find('caption').text().includes('Indicateurs par projet'))!
    expect(tableau.exists()).toBe(true)
    const lignes = tableau.findAll('tbody tr').map((ligne) => ligne.findAll('td').map((cellule) => cellule.text()))
    expect(lignes).toEqual([
      ['pret-de-materiel', '5', '25 min'],
      ['annuaire', '0', 'Pas encore mesurable'],
    ])
    wrapper.unmount()
  })

  it('pendant le calcul : un squelette de la page, annoncé aux lecteurs d’écran', async () => {
    lire.mockReturnValue(new Promise(() => {}))
    const wrapper = await monter()
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.findAll('.squelette__carte')).toHaveLength(4)
    expect(wrapper.find('[role="status"]').text()).toBe('Calcul des indicateurs…')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('explique l’erreur si GitHub ne répond pas', async () => {
    lire.mockRejectedValue(new ErreurApi(502, 'GitHub ne répond pas'))
    const wrapper = await monter()
    expect(wrapper.text()).toContain('GitHub ne répond pas')
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité automatique', async () => {
    lire.mockImplementation(async (chemin: string) => (chemin === '/indicateurs/empreinte' ? EMPREINTE : INDICATEURS))
    const wrapper = await monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
})

describe('Mise en forme des indicateurs', () => {
  it.each([
    [null, 'Pas encore mesurable'],
    [0.2, '1 min'],
    [25, '25 min'],
    [65, '1 h 05'],
    [60 * 51, '2 j 3 h'],
  ])('durée %s min → « %s »', (minutes, texte) => {
    expect(duree(minutes)).toBe(texte)
  })


  it('empreinte carbone : fourchette, équivalents ADEME, détail par projet, méthode et limites', async () => {
    lire.mockImplementation(async (chemin: string) => (chemin === '/indicateurs/empreinte' ? EMPREINTE : INDICATEURS))
    const wrapper = await monter()
    const section = wrapper.find('section[aria-labelledby="titre-empreinte"]')
    expect(section.text()).toContain('48 à 115 g CO2e')
    expect(section.text()).toContain('0,75 à 1,8 h de streaming vidéo')
    expect(section.text()).toContain('en voiture thermique')
    expect(section.text()).toContain('une ampoule LED de 10 W allumée')
    expect(section.text()).toContain('hypothèse d’ADA')
    expect(section.text()).toContain('gladys')
    expect(section.text()).toContain('EcoLogits')
    expect(section.text()).toContain('Anthropic ne publie ni la taille de ses modèles')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('empreinte indisponible : le reste de la page s’affiche quand même', async () => {
    lire.mockImplementation(async (chemin: string) => {
      if (chemin === '/indicateurs/empreinte') throw new Error('absent')
      return INDICATEURS
    })
    const wrapper = await monter()
    expect(wrapper.find('section[aria-labelledby="titre-empreinte"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Stories livrées')
    wrapper.unmount()
  })
})
