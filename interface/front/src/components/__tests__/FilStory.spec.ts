import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Ui from '@/components/ui'
import FilStory from '../FilStory.vue'
import { api } from '@/services/api'
import type { DetailStory } from '@/lib/story'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const story: DetailStory = {
  numero: 12,
  titre: 'Voir les salles libres',
  statut: 'questions',
  prete: true,
  raison: null,
  creeeLe: '2026-11-16T10:00:00Z',
  fermeeLe: null,
  url: 'https://github.com/proprio/poc/issues/12',
  type: 'story',
  texteBrut: '',
  assignes: [],
  contenuBug: null,
  contenuLibre: null,
  contenu: {
    role: "agent d'accueil",
    besoin: 'voir les salles libres',
    benefice: 'proposer une salle',
    criteres: ['une salle sans réservation en cours est libre'],
  },
  messages: [
    { id: 1, auteur: 'assistant', avatar: null, texte: 'Que veut dire « en ce moment » ?', le: '2026-11-16T10:05:00Z' },
  ],
}

const monter = () =>
  mount(FilStory, { props: { story }, global: { plugins: [Ui] }, attachTo: document.body })

describe('Fil d’une story', () => {
  const monterAvec = (props: Record<string, unknown>) =>
    mount(FilStory, {
      props: { story, ...props },
      global: { plugins: [Ui], stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
      attachTo: document.body,
    })
  const bouton = (wrapper: ReturnType<typeof monterAvec>, texte: string) =>
    wrapper.findAll('button').find((b) => b.text().includes(texte))

  it('ne demande rien d’écrire tant que la story n’est pas lancée', () => {
    const wrapper = monterAvec({ story: { ...story, statut: 'nouvelle', messages: [] } })
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })

  it('montre que ADA travaille, avec ses dernières actions, sans rien demander', async () => {
    const wrapper = monterAvec({
      story: { ...story, statut: 'en-cours' },
      activite: {
        phase: 'realisation',
        enCours: true,
        debut: '2026-11-16T14:00:00Z',
        journal: [
          { le: '2026-11-16T14:01:00Z', texte: 'Lit src/App.vue' },
          { le: '2026-11-16T14:02:00Z', texte: 'Lance les tests' },
        ],
        erreur: null,
        pullRequest: null,
      },
    })
    expect(wrapper.text()).toContain('ADA réalise la demande…')
    expect(wrapper.text()).toContain('ce n’est pas encore terminé')
    expect(wrapper.text()).toContain('Lance les tests')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('prévient que des commentaires écrits directement sur GitHub ne sont pas lus par ADA', async () => {
    const wrapper = monterAvec({ story: { ...story, commentairesIgnores: 2 } })
    expect(wrapper.text()).toContain('2 commentaires ont été écrits directement sur GitHub. ADA ne les lit pas')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
    const un = monterAvec({ story: { ...story, commentairesIgnores: 1 } })
    expect(un.text()).toContain('Un commentaire a été écrit directement sur GitHub. ADA ne le lit pas')
    un.unmount()
    const aucun = monterAvec({ story: { ...story, commentairesIgnores: 0 } })
    expect(aucun.text()).not.toContain('directement sur GitHub. ADA ne')
    aucun.unmount()
  })

  it('signe « ADA » les messages d’ADA, sans marqueur technique', () => {
    const wrapper = monterAvec({
      story: {
        ...story,
        messages: [{ id: 9, auteur: 'po1', avatar: null, texte: '<!-- ada-studio:assistant -->\n🤖 **Plan proposé**\n\nJe vais…', le: '2026-11-16T10:05:00Z' }],
      },
    })
    expect(wrapper.text()).toContain('ADA — ')
    expect(wrapper.text()).not.toContain('ada-studio:assistant')
    wrapper.unmount()
  })

  it('fait valider le plan par un bouton', async () => {
    const wrapper = monterAvec({ story: { ...story, statut: 'plan-a-valider' } })
    expect(wrapper.find('textarea').exists()).toBe(false)
    await bouton(wrapper, 'Valider le plan')!.trigger('click')
    expect(wrapper.emitted('valider')).toHaveLength(1)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('prévient que la validation du plan et les réponses sont enregistrées en commentaire GitHub', async () => {
    const plan = monterAvec({ story: { ...story, statut: 'plan-a-valider' } })
    expect(plan.find('#validation-enregistrement').text()).toContain('en commentaire de la story n° 12, à votre nom')
    expect(bouton(plan, 'Valider le plan')!.attributes('aria-describedby')).toBe('validation-enregistrement')
    plan.unmount()
    const questions = monterAvec({})
    expect(questions.find('#reponse-enregistrement').text()).toContain('enregistré tel quel sur GitHub, en commentaire de la story n° 12')
    expect(bouton(questions, 'Envoyer')!.attributes('aria-describedby')).toBe('reponse-enregistrement')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    questions.unmount()
    const nouvelle = monterAvec({ story: { ...story, statut: 'nouvelle' } })
    expect(nouvelle.find('#lancement-enregistrement').text()).toContain('un commentaire et le statut de la story n° 12')
    nouvelle.unmount()
    const signalement = monterAvec({ story: { ...story, type: 'bug', numero: 4 } })
    expect(signalement.find('#reponse-enregistrement').text()).toContain('en commentaire du signalement n° 4')
    signalement.unmount()
  })

  it('explique pourquoi les échanges sont enregistrés sur GitHub (replié par défaut)', async () => {
    const wrapper = monterAvec({})
    const bouton = wrapper.findAll('button[aria-expanded]').find((element) => element.text().startsWith('Pourquoi'))!
    expect(bouton.text()).toBe('Pourquoi les échanges sont-ils enregistrés sur GitHub ?')
    expect(bouton.attributes('aria-expanded')).toBe('false')
    await bouton.trigger('click')
    expect(wrapper.text()).toContain('Traçabilité')
    expect(wrapper.text()).toContain('commentaires de la story n° 12')
    expect(wrapper.text()).toContain('N’y écrivez donc rien de confidentiel')
    // ADR-0011 : ce qui s'écrit sur GitHub hors d'ADA ne lui parvient pas.
    expect(wrapper.text()).toContain('ce qui est écrit ou modifié directement sur GitHub ne lui parvient pas')
    expect(wrapper.text()).not.toContain('prochaine lecture')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })

  it('questions à choix : réponse en cases à cocher au lieu du champ libre', async () => {
    const octets = new TextEncoder().encode(JSON.stringify([{ question: 'Retour le jour même ?', choix: ['Oui', 'Non'], plusieurs: false }]))
    const texte = `<!-- ada-studio:assistant -->\n🤖 **Questions d’ADA**\n\nUne règle.\n\n<!-- ada:choix ${btoa(String.fromCharCode(...octets))} -->`
    const wrapper = monterAvec({ story: { ...story, messages: [...story.messages, { id: 99, auteur: 'robot', avatar: null, le: '2026-11-16T10:00:00Z', texte }] } })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('vos réponses sont enregistrées sur GitHub, en commentaire de la story n° 12')
    await wrapper.find('#choix-0-0').trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('repondre')?.[0]).toEqual(['1. Retour le jour même ?\n→ Oui'])
    wrapper.unmount()
  })

  it('découpage proposé : les stories à cocher, puis leur création demandée', async () => {
    const stories = [
      { titre: 'Voir', role: 'agent', besoin: 'voir', benefice: 'savoir', criteres: ['a'] },
      { titre: 'Rendre', role: 'agent', besoin: 'rendre', benefice: 'libérer', criteres: ['b'] },
    ]
    const donnees = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(stories))))
    const texte = `<!-- ada-studio:assistant -->\n🤖 **Découpage proposé**\n\nTrop gros.\n\n<!-- ada:decoupage ${donnees} -->`
    const wrapper = monterAvec({ story: { ...story, statut: 'decoupage', messages: [...story.messages, { id: 98, auteur: 'robot', avatar: null, le: '2026-11-16T10:00:00Z', texte }] } })
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('creerDecoupage')).toEqual([[stories]])
    await bouton(wrapper, 'Demander un autre découpage')!.trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.text()).toContain('Ce qu’il faut changer dans le découpage')
    wrapper.unmount()
  })

  it('demande parent : ses stories, livrées ou à faire, à ouvrir', async () => {
    const wrapper = monterAvec({ story: { ...story, statut: 'parent', texteBrut: '### Demande\n\nTout\n\n### Découpage\n\n- [x] #7 Voir\n- [ ] #8 Rendre\n' } })
    expect(wrapper.text()).toContain('Découpée en 2 stories')
    await bouton(wrapper, '#8 Rendre — à faire')!.trigger('click')
    expect(wrapper.emitted('ouvrir')).toEqual([[8]])
    expect(bouton(wrapper, '#7 Voir — livrée')).toBeDefined()
    wrapper.unmount()
  })

  it('ordre de lecture : le dernier message d’ADA (qui explique), puis l’action attendue, la story, et l’historique replié', () => {
    const assistant = (id: number, texte: string) => ({ id, auteur: 'robot', avatar: null, texte: `<!-- ada-studio:assistant -->\n${texte}`, le: `2026-11-16T10:0${id}:00Z` })
    const wrapper = monterAvec({
      story: {
        ...story,
        statut: 'plan-a-valider',
        messages: [assistant(1, 'Premières questions'), { id: 2, auteur: 'po1', avatar: null, texte: 'Mes réponses', le: '2026-11-16T10:02:00Z' }, assistant(3, 'Le plan proposé')],
      },
    })
    const titres = wrapper.findAll('h3').map((titre) => titre.text())
    expect(titres.slice(0, 4)).toEqual(['Dernier message d’ADA', 'À vous de jouer', 'La story', 'Suivi'])
    expect(wrapper.find('.dernier-message').text()).toContain('Le plan proposé')
    const historique = wrapper.findAll('button[aria-expanded]').find((bouton) => bouton.text().startsWith('Voir l’historique'))!
    expect(historique.text()).toBe('Voir l’historique (2 échanges)')
    expect(historique.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.fil').text()).toContain('Premières questions')
    expect(wrapper.find('.fil').text()).not.toContain('Le plan proposé')
    wrapper.unmount()
  })

  it('pendant que ADA travaille, l’encart du haut le dit (aucune action demandée)', () => {
    const wrapper = monterAvec({ story: { ...story, statut: 'en-cours' }, activite: { enCours: true, phase: 'analyse', debut: null, journal: [], erreur: null, pullRequest: null } })
    expect(wrapper.find('h3').text()).toBe('ADA travaille')
    expect(wrapper.text()).not.toContain('À vous de jouer')
    // Téléporté dans la page (hors de la colonne qui défile) : on le cherche dans le document.
    const avatar = document.querySelector('[data-testid="avatar-ada"]')!
    expect(avatar.textContent).toContain('ADA analyse…')
    expect(wrapper.find('[data-testid="avatar-ada"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('permet de demander une modification du plan', async () => {
    const wrapper = monterAvec({ story: { ...story, statut: 'plan-a-valider' } })
    await bouton(wrapper, 'Demander une modification')!.trigger('click')
    await wrapper.find('textarea').setValue('Ajouter la météo')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('repondre')?.[0]).toEqual(['Ajouter la météo'])
    wrapper.unmount()
  })

  it('demande une réponse quand ADA pose des questions', async () => {
    const wrapper = monterAvec({})
    expect(wrapper.text()).toContain('ADA attend vos réponses')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('repondre')).toBeUndefined()
    expect(wrapper.text()).toContain('Écrivez vos réponses')
    await wrapper.find('textarea').setValue('  En toutes lettres.  ')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('repondre')?.[0]).toEqual(['En toutes lettres.'])
    wrapper.unmount()
  })

  it('conversation : tout le fil s’affiche, et les actions remontent à l’atelier', async () => {
    const wrapper = monterAvec({
      story: {
        ...story,
        type: 'conversation',
        statut: 'echange',
        contenu: null,
        contenuLibre: 'Mets le titre en bleu',
        messages: [{ id: 5, auteur: 'po1', avatar: null, texte: '<!-- ada-studio:assistant -->\n🤖 **ADA**\n\nC’est fait.', le: '2026-11-18T10:01:00Z' }],
      },
    })
    expect(wrapper.find('#titre-conversation').exists()).toBe(true)
    expect(wrapper.find('#titre-dernier-message').exists()).toBe(false)
    await wrapper.find('textarea').setValue('plutôt en rouge')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('envoyerMessage')).toEqual([['plutôt en rouge']])
    await bouton(wrapper, 'C’est bon : proposer ces changements')!.trigger('click')
    expect(wrapper.emitted('terminerConversation')).toHaveLength(1)
    wrapper.unmount()
  })

  it('montre l’empreinte carbone estimée de la demande, avec son équivalent', async () => {
    const lecture = vi.spyOn(api, 'lire').mockResolvedValue({
      empreinte: { energieWh: { min: 12, max: 29 }, co2g: { min: 4.8, max: 11 }, tokensSortie: 1000, tokensEntree: 0 },
      equivalents: { streamingHeureG: 64 },
    })
    const wrapper = monterAvec({ projet: 'gladys', story: { ...story, statut: 'en-cours' } })
    await flushPromises()
    expect(lecture).toHaveBeenCalledWith(`/projets/gladys/stories/${story.numero}/empreinte`)
    expect(wrapper.find('[data-testid="empreinte-demande"]').text()).toContain('4,8 à 11 g CO2e, soit 4,5 à 10 min de streaming vidéo')
    lecture.mockRestore()
    wrapper.unmount()
  })

  it('propose de relancer ADA sur une demande en cours où rien ne tourne', async () => {
    const wrapper = monterAvec({
      story: { ...story, statut: 'en-cours' },
      activite: { phase: null, enCours: false, debut: null, journal: [], erreur: null, pullRequest: null },
    })
    expect(wrapper.text()).toContain('ADA ne travaille pas sur cette demande en ce moment')
    expect(document.querySelector('[data-testid="avatar-ada"]')).toBeNull()
    await bouton(wrapper, 'Relancer ADA')!.trigger('click')
    expect(wrapper.emitted('relancer')).toHaveLength(1)
    wrapper.unmount()
  })

  describe('Vérification et fusion', () => {
    const controle = (etat: 'reussi' | 'en-cours' | 'echec' | 'non-lance') => [
      { nom: 'Anti-fuite (gitleaks)', etat: 'reussi' as const, lien: null },
      { nom: 'Front', etat, lien: null },
    ]
    const verification = (etat: 'reussi' | 'en-cours' | 'echec' | 'non-lance', fusionnable: boolean, raison: string | null) => ({
      pullRequest: { numero: 3, url: 'https://github.com/p/poc/pull/3', etat: 'ouverte' as const },
      controles: controle(etat),
      fusionnable,
      raison,
    })

    it('n’active « Valider et fusionner » que si tous les contrôles sont réussis', async () => {
      const wrapper = monterAvec({ story: { ...story, statut: 'en-verification' }, verification: verification('reussi', true, null) })
      expect(wrapper.text()).toContain('À vous de vérifier')
      expect(wrapper.text()).toContain('Front : réussi')
      const fusion = bouton(wrapper, 'Valider et fusionner')!
      expect(fusion.attributes('disabled')).toBeUndefined()
      await fusion.trigger('click')
      expect(wrapper.emitted('fusionner')).toHaveLength(1)
      expect(await violationsAccessibilite(document.body)).toEqual([])
      wrapper.unmount()
    })

    it('garde le bouton inactif pendant les contrôles, et dit pourquoi', () => {
      const wrapper = monterAvec({ story: { ...story, statut: 'en-verification' }, verification: verification('en-cours', false, 'Contrôles en cours…') })
      expect(bouton(wrapper, 'Valider et fusionner')!.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('Contrôles en cours…')
      expect(wrapper.text()).toContain('Front : en cours')
      expect(bouton(wrapper, 'Relancer les contrôles')).toBeUndefined()
      wrapper.unmount()
    })

    it('contrôles non lancés par GitHub (facturation) : la cause est dite, le PO peut les relancer', async () => {
      const raison = 'GitHub n’a pas lancé les contrôles : … Billing & plans …'
      const wrapper = monterAvec({ story: { ...story, statut: 'en-verification' }, verification: verification('non-lance', false, raison) })
      expect(wrapper.text()).toContain('Front : non lancé par GitHub')
      expect(wrapper.text()).toContain(raison)
      await bouton(wrapper, 'Relancer les contrôles')!.trigger('click')
      expect(wrapper.emitted('relancerControles')).toHaveLength(1)
      expect(await violationsAccessibilite(document.body)).toEqual([])
      wrapper.unmount()
    })
  })

  it('affiche une demande libre (mode sauvage)', () => {
    const wrapper = monterAvec({ story: { ...story, type: 'libre', contenu: null, contenuLibre: 'Mets le titre en bleu' } })
    expect(wrapper.text()).toContain('Demande libre (hors story)')
    expect(wrapper.text()).toContain('Mets le titre en bleu')
    expect(wrapper.text()).toContain('Enregistrée sur GitHub comme demande n° 12 « mode libre »')
    wrapper.unmount()
  })

  it('montre le lien vers la pull request une fois la réalisation terminée', () => {
    const wrapper = monterAvec({
      story: { ...story, statut: 'en-verification' },
      activite: { phase: 'realisation', enCours: false, debut: null, journal: [], erreur: null, pullRequest: 'https://github.com/p/poc/pull/2' },
    })
    expect(wrapper.find('a[href="https://github.com/p/poc/pull/2"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('affiche la story structurée, son statut et la conversation', () => {
    const wrapper = monter()
    expect(wrapper.text()).toContain("En tant que agent d'accueil")
    expect(wrapper.text()).toContain('une salle sans réservation en cours est libre')
    expect(wrapper.text()).toContain('Questions')
    expect(wrapper.text()).toContain('Que veut dire « en ce moment » ?')
    wrapper.unmount()
  })

  it('aucune violation d’accessibilité automatique', async () => {
    const wrapper = monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
  it('affiche un problème signalé, sans violation d’accessibilité', async () => {
    const wrapper = mount(FilStory, {
      props: {
        story: {
          ...story,
          type: 'bug',
          contenu: null,
          contenuBug: {
            constate: 'Aucune salle le lundi',
            attendu: 'Les salles libres',
            etapes: '1. Ouvrir la liste un lundi',
            ecran: '/salles-libres',
          },
        },
      },
      global: { plugins: [Ui] },
      attachTo: document.body,
    })
    expect(wrapper.text()).toContain('Ce qui se passe')
    expect(wrapper.text()).toContain('Aucune salle le lundi')
    expect(wrapper.text()).toContain('/salles-libres')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    wrapper.unmount()
  })
  describe('Lancement', () => {
    const nouvelle = { ...story, statut: 'nouvelle' as const, messages: [] }

    it('propose de lancer une story prête quand rien d’autre n’est en cours', async () => {
      const wrapper = mount(FilStory, { props: { story: nouvelle }, global: { plugins: [Ui] }, attachTo: document.body })
      const bouton = wrapper.findAll('button').find((b) => b.text().includes('Lancer cette story'))!
      await bouton.trigger('click')
      expect(wrapper.emitted('lancer')).toHaveLength(1)
      expect(await violationsAccessibilite(document.body)).toEqual([])
      wrapper.unmount()
    })

    it('propose de relancer une demande mise en attente par ADA', async () => {
      const wrapper = mount(FilStory, { props: { story: { ...nouvelle, statut: 'attente' as const } }, global: { plugins: [Ui] }, attachTo: document.body })
      expect(wrapper.text()).toContain('ADA a mis cette demande en attente')
      const bouton = wrapper.findAll('button').find((b) => b.text().includes('Relancer cette story'))!
      await bouton.trigger('click')
      expect(wrapper.emitted('lancer')).toHaveLength(1)
      expect(await violationsAccessibilite(document.body)).toEqual([])
      wrapper.unmount()
    })

    it('explique qu’une autre demande est en cours, sans bouton', () => {
      const wrapper = mount(FilStory, {
        props: { story: nouvelle, autreEnCours: { numero: 7, titre: 'Accueil' } },
        global: { plugins: [Ui] },
      })
      expect(wrapper.text()).toContain('La demande #7 « Accueil » est en cours : une seule à la fois')
      expect(wrapper.findAll('button').some((b) => b.text().includes('Lancer'))).toBe(false)
    })

    it('demande de corriger sur GitHub une story qui n’est pas prête', () => {
      const wrapper = mount(FilStory, {
        props: { story: { ...nouvelle, prete: false, raison: 'Plus de 4 critères : découpez-la' } },
        global: { plugins: [Ui] },
      })
      expect(wrapper.text()).toContain('À corriger sur GitHub avant de la lancer : Plus de 4 critères')
      expect(wrapper.findAll('button').some((b) => b.text().includes('Lancer'))).toBe(false)
    })

    it('ne propose plus de lancer une story déjà en cours', () => {
      const wrapper = mount(FilStory, {
        props: { story: { ...nouvelle, statut: 'en-cours' } },
        global: { plugins: [Ui] },
      })
      expect(wrapper.findAll('button').some((b) => b.text().includes('Lancer'))).toBe(false)
    })
  })
})
