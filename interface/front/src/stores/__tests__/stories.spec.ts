import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useStoriesStore } from '../stories'
import { api, ErreurApi } from '@/services/api'
import type { DetailStory, ResumeStory } from '@/lib/story'

vi.mock('@/services/api', async (original) => ({
  ...(await original<typeof import('@/services/api')>()),
  api: {
    lire: vi.fn<(chemin: string) => Promise<unknown>>(),
    envoyer: vi.fn<(chemin: string, corps: unknown) => Promise<unknown>>(),
  },
}))
const lire = vi.mocked(api.lire)
const envoyer = vi.mocked(api.envoyer)

const resume = (numero: number, extra: Partial<ResumeStory> = {}): ResumeStory => ({
  numero,
  type: 'story',
  titre: `Story ${numero}`,
  statut: 'nouvelle',
  creeeLe: '2026-11-16T10:00:00Z',
  fermeeLe: null,
  url: 'https://github.com/x',
  prete: true,
  raison: null,
  ...extra,
})

const detail = (numero: number, extra: Partial<DetailStory> = {}) => ({
  ...resume(numero, extra),
  assignes: [],
  contenu: null,
  contenuBug: null,
  contenuLibre: null,
  texteBrut: '',
  messages: [],
})

describe('Store des stories', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    lire.mockReset()
    envoyer.mockReset()
  })

  it('charge les stories écrites dans GitHub pour le projet choisi', async () => {
    lire.mockResolvedValue([resume(1)])
    const store = useStoriesStore()
    await store.charger('mon-poc')
    expect(lire).toHaveBeenCalledWith('/projets/mon-poc/stories')
    expect(store.liste).toHaveLength(1)
  })

  it('repère la demande qui occupe le projet', () => {
    const store = useStoriesStore()
    store.liste = [resume(3), resume(2, { statut: 'questions' }), resume(1, { statut: 'livree' })]
    expect(store.active?.numero).toBe(2)
  })

  it('lance une story puis relit la liste et la story ; sans demande ouverte, la relit d’abord pour en avoir l’empreinte', async () => {
    const store = useStoriesStore()
    envoyer.mockResolvedValue(resume(2, { statut: 'en-cours' }))
    lire.mockImplementation(async (chemin: string) =>
      chemin.endsWith('/stories') ? [resume(2, { statut: 'en-cours' })] : detail(2, { statut: 'en-cours', empreinte: 'lue-avant-le-lancement' }),
    )
    await store.lancer('mon-poc', 2)
    expect(envoyer).toHaveBeenCalledWith('/projets/mon-poc/stories/2/lancer', { empreinte: 'lue-avant-le-lancement' })
    expect(lire.mock.invocationCallOrder[0]).toBeLessThan(envoyer.mock.invocationCallOrder[0]!)
    expect(store.liste[0]?.statut).toBe('en-cours')
    expect(store.courante?.statut).toBe('en-cours')
    expect(store.erreurLancement).toBeNull()
  })

  it('renvoie au lancement l’empreinte de la demande affichée', async () => {
    const store = useStoriesStore()
    store.courante = detail(2, { empreinte: 'empreinte-affichee' })
    envoyer.mockResolvedValue(resume(2, { statut: 'en-cours' }))
    lire.mockImplementation(async (chemin: string) => (chemin.endsWith('/stories') ? [resume(2)] : detail(2)))
    await store.lancer('mon-poc', 2)
    expect(envoyer).toHaveBeenCalledWith('/projets/mon-poc/stories/2/lancer', { empreinte: 'empreinte-affichee' })
  })

  it('demande modifiée sur GitHub entre-temps : montre la nouvelle version et garde le message', async () => {
    const store = useStoriesStore()
    store.courante = detail(2, { empreinte: 'ancienne', titre: 'Ancien titre' })
    envoyer.mockRejectedValue(new ErreurApi(409, 'Cette demande a été modifiée sur GitHub depuis que vous l’avez ouverte. Relisez-la, puis lancez-la de nouveau.'))
    lire.mockResolvedValue(detail(2, { empreinte: 'nouvelle', titre: 'Nouveau titre' }))
    await store.lancer('mon-poc', 2)
    expect(store.courante?.titre).toBe('Nouveau titre')
    expect(store.erreurLancement).toMatch(/modifiée sur GitHub/)
  })

  it('garde le message de refus du lancement (une autre est en cours)', async () => {
    const store = useStoriesStore()
    envoyer.mockRejectedValue(new ErreurApi(409, 'La demande #1 « A » est en cours : une seule demande à la fois'))
    await store.lancer('mon-poc', 2)
    expect(store.erreurLancement).toMatch(/une seule demande à la fois/)
  })

  it('valide le plan puis relit la demande et son activité', async () => {
    const store = useStoriesStore()
    envoyer.mockResolvedValue({ ok: true })
    lire.mockImplementation(async (chemin: string) =>
      chemin.endsWith('/activite')
        ? { phase: 'realisation', enCours: true, debut: null, journal: [], erreur: null, pullRequest: null }
        : chemin.endsWith('/stories')
          ? [resume(2, { statut: 'en-cours' })]
          : detail(2, { statut: 'en-cours' }),
    )
    await store.validerPlan('mon-poc', 2)
    expect(envoyer).toHaveBeenCalledWith('/projets/mon-poc/stories/2/plan/valider', {})
    expect(store.activite?.enCours).toBe(true)
    expect(store.courante?.statut).toBe('en-cours')
  })

  it('envoie la réponse du PO à ADA', async () => {
    const store = useStoriesStore()
    envoyer.mockResolvedValue({ ok: true })
    lire.mockImplementation(async (chemin: string) => (chemin.endsWith('/stories') ? [] : detail(3)))
    await store.repondre('mon-poc', 3, 'Oui')
    expect(envoyer).toHaveBeenCalledWith('/projets/mon-poc/stories/3/reponse', { texte: 'Oui' })
  })

  it('fusionne la demande : livrée, elle passe dans « Déjà livrées » et son détail se ferme', async () => {
    const store = useStoriesStore()
    store.courante = detail(2, { statut: 'en-verification' })
    envoyer.mockResolvedValue({ pullRequest: { numero: 3, url: 'u', etat: 'fusionnee' }, controles: [], fusionnable: false, raison: 'Déjà fusionnée' })
    lire.mockImplementation(async (chemin: string) => (chemin.endsWith('/stories') ? [resume(2, { statut: 'livree' })] : detail(2, { statut: 'livree' })))
    await store.fusionner('mon-poc', 2)
    expect(envoyer).toHaveBeenCalledWith('/projets/mon-poc/stories/2/fusionner', {})
    expect(store.active).toBeNull()
    expect(store.courante).toBeNull()
    expect(store.aFaire).toEqual([])
    expect(store.livrees.map((story) => story.numero)).toEqual([2])
  })

  it('fusion différée (branche mise à jour, contrôles relancés) : la demande reste ouverte', async () => {
    const store = useStoriesStore()
    store.courante = detail(2, { statut: 'en-verification' })
    envoyer.mockResolvedValue({ pullRequest: { numero: 3, url: 'u', etat: 'ouverte' }, controles: [], fusionnable: false, raison: 'Le projet a évolué' })
    lire.mockImplementation(async (chemin: string) =>
      chemin.endsWith('/stories') ? [resume(2, { statut: 'en-verification' })] : chemin.endsWith('/activite') ? null : detail(2, { statut: 'en-verification' }),
    )
    await store.fusionner('mon-poc', 2)
    expect(store.courante?.numero).toBe(2)
    expect(store.verification?.raison).toBe('Le projet a évolué')
  })

  it('sépare ce qui reste à faire des livrées, les plus récentes d’abord', () => {
    const store = useStoriesStore()
    store.liste = [
      resume(1, { statut: 'livree', fermeeLe: '2026-11-10T10:00:00Z' }),
      resume(2, { statut: 'en-cours' }),
      resume(3, { statut: 'livree', fermeeLe: '2026-11-12T10:00:00Z' }),
      resume(4),
    ]
    expect(store.aFaire.map((story) => story.numero)).toEqual([2, 4])
    expect(store.livrees.map((story) => story.numero)).toEqual([3, 1])
  })

  it('mode sauvage : envoie le prompt, puis ouvre la demande créée', async () => {
    const store = useStoriesStore()
    envoyer.mockResolvedValue(resume(9, { type: 'libre', statut: 'en-cours' }))
    lire.mockImplementation(async (chemin: string) =>
      chemin.endsWith('/stories') ? [resume(9, { type: 'libre', statut: 'en-cours' })] : chemin.endsWith('/activite') ? null : detail(9, { type: 'libre', statut: 'en-cours' }),
    )
    expect(await store.prompter('mon-poc', 'Mets le titre en bleu')).toBeNull()
    expect(envoyer).toHaveBeenCalledWith('/projets/mon-poc/stories/prompt', { texte: 'Mets le titre en bleu' })
    expect(store.courante?.numero).toBe(9)
  })

  it('mode sauvage : renvoie le refus (une autre demande en cours)', async () => {
    const store = useStoriesStore()
    envoyer.mockRejectedValue(new ErreurApi(409, 'La demande #1 « A » est en cours : une seule demande à la fois'))
    expect(await store.prompter('mon-poc', 'Mets le titre en bleu')).toMatch(/une seule demande à la fois/)
  })

  it('garde le message si l’action est refusée', async () => {
    const store = useStoriesStore()
    envoyer.mockRejectedValue(new ErreurApi(409, 'Aucun plan n’attend votre validation'))
    await store.validerPlan('mon-poc', 2)
    expect(store.erreurAction).toBe('Aucun plan n’attend votre validation')
  })
})
