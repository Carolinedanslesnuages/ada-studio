import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Ui from '@/components/ui'
import BoutonDicter from '../BoutonDicter.vue'
import ConversationAda from '../ConversationAda.vue'
import FormulairePrompt from '../FormulairePrompt.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import type { DetailStory } from '@/lib/story'

/** Fausse reconnaissance vocale : le test « dit » une phrase, ou provoque une erreur. */
class FausseReconnaissance {
  static derniere: FausseReconnaissance | null = null
  lang = ''
  continuous = false
  interimResults = true
  onresult: ((evenement: { resultIndex: number; results: unknown[] }) => void) | null = null
  onerror: ((evenement: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  demarree = false
  constructor() {
    FausseReconnaissance.derniere = this
  }
  start() {
    this.demarree = true
  }
  stop() {
    this.onend?.()
  }
  dire(phrase: string, finale = true) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: phrase }], { isFinal: finale })] })
  }
}

describe('Dictée', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('absente quand le navigateur ne propose pas la reconnaissance vocale (Firefox)', () => {
    const wrapper = mount(BoutonDicter, { props: { champ: 'x' }, global: { plugins: [Ui] } })
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('écoute en français, transmet chaque phrase reconnue, puis s’arrête', async () => {
    vi.stubGlobal('webkitSpeechRecognition', FausseReconnaissance)
    document.body.insertAdjacentHTML('beforeend', '<label for="message">Message</label><textarea id="message"></textarea>')
    const wrapper = mount(BoutonDicter, { props: { champ: 'message' }, global: { plugins: [Ui] }, attachTo: document.body })
    const bouton = wrapper.get('button')
    expect(bouton.text()).toBe('Dicter')
    expect(bouton.attributes('title')).toContain('service de reconnaissance de votre navigateur')
    await bouton.trigger('click')
    const reconnaissance = FausseReconnaissance.derniere!
    expect(reconnaissance.lang).toBe('fr-FR')
    expect(reconnaissance.demarree).toBe(true)
    expect(bouton.text()).toBe('Arrêter la dictée')
    expect(wrapper.text()).toContain('Dictée en cours')
    reconnaissance.dire('mets le titre', false)
    reconnaissance.dire('mets le titre en bleu')
    expect(wrapper.emitted('texte')).toEqual([['mets le titre en bleu']])
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await bouton.trigger('click')
    expect(bouton.text()).toBe('Dicter')
    wrapper.unmount()
  })

  it('dit simplement pourquoi la dictée ne marche pas (micro refusé)', async () => {
    vi.stubGlobal('webkitSpeechRecognition', FausseReconnaissance)
    const wrapper = mount(BoutonDicter, { props: { champ: 'message' }, global: { plugins: [Ui] } })
    await wrapper.get('button').trigger('click')
    FausseReconnaissance.derniere!.onerror?.({ error: 'not-allowed' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Le micro est refusé')
    wrapper.unmount()
  })

  it('dans la conversation, la phrase dictée s’ajoute au message', async () => {
    vi.stubGlobal('webkitSpeechRecognition', FausseReconnaissance)
    const story = { numero: 9, type: 'conversation', titre: 'Conversation : x', statut: 'echange', creeeLe: '', fermeeLe: null, url: '', prete: true, raison: null, assignes: [], contenu: null, contenuBug: null, contenuLibre: 'Bonjour', texteBrut: '', messages: [] } as DetailStory
    const wrapper = mount(ConversationAda, { props: { story, attendReponse: true }, global: { plugins: [Ui] }, attachTo: document.body })
    await wrapper.find('textarea').setValue('Plutôt')
    await wrapper.findAll('button').find((b) => b.text() === 'Dicter')!.trigger('click')
    FausseReconnaissance.derniere!.dire('en rouge')
    await wrapper.vm.$nextTick()
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('Plutôt en rouge')
    expect(wrapper.findAll('button').find((b) => b.text() === 'Arrêter la dictée')!.attributes('aria-controls')).toBe('message-conversation')
    wrapper.unmount()
  })

  it('le champ de la demande guidée porte l’identifiant que la dictée désigne', () => {
    vi.stubGlobal('webkitSpeechRecognition', FausseReconnaissance)
    const wrapper = mount(FormulairePrompt, { global: { plugins: [Ui] }, attachTo: document.body })
    expect(document.getElementById('texte-prompt')?.tagName).toBe('TEXTAREA')
    wrapper.unmount()
  })
})
