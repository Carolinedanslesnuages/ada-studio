<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

/**
 * « Dicter » : pour qui peut cliquer mais pas taper. Reconnaissance vocale du navigateur, en
 * français ; chaque phrase reconnue est ajoutée au message. Absent si le navigateur ne la propose
 * pas (Firefox). L'audio est traité par le service du navigateur (Google pour Chrome, Microsoft
 * pour Edge, Apple pour Safari) : la personne en est informée.
 * Qui ne peut ni taper ni cliquer pilote ADA avec l'outil de son système (Commande vocale,
 * Accès vocal, Dragon) : chaque bouton porte pour cela un intitulé visible, à prononcer.
 */
const props = defineProps<{ champ: string }>()
const emit = defineEmits<{ texte: [phrase: string] }>()

interface ResultatReconnaissance {
  isFinal: boolean
  0: { transcript: string }
}
interface Reconnaissance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((evenement: { resultIndex: number; results: ArrayLike<ResultatReconnaissance> }) => void) | null
  onerror: ((evenement: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type ConstructeurReconnaissance = new () => Reconnaissance

const fenetre = window as unknown as { SpeechRecognition?: ConstructeurReconnaissance; webkitSpeechRecognition?: ConstructeurReconnaissance }
const Constructeur = fenetre.SpeechRecognition ?? fenetre.webkitSpeechRecognition
const disponible = Boolean(Constructeur)

const ecoute = ref(false)
const erreur = ref('')
let reconnaissance: Reconnaissance | null = null

const MESSAGES_ERREUR: Record<string, string> = {
  'not-allowed': 'Le micro est refusé : autorisez-le pour ADA dans les réglages du navigateur.',
  'no-speech': 'Je n’ai rien entendu. Cliquez sur « Dicter » et parlez.',
  network: 'La dictée a besoin d’internet : vérifiez la connexion.',
}

function arreter(): void {
  reconnaissance?.stop()
}

function basculer(): void {
  if (ecoute.value) {
    arreter()
    return
  }
  if (!Constructeur) return
  erreur.value = ''
  reconnaissance = new Constructeur()
  reconnaissance.lang = 'fr-FR'
  reconnaissance.continuous = true
  reconnaissance.interimResults = false
  reconnaissance.onresult = (evenement) => {
    for (let rang = evenement.resultIndex; rang < evenement.results.length; rang++) {
      const resultat = evenement.results[rang]!
      const phrase = resultat[0].transcript.trim()
      if (resultat.isFinal && phrase) emit('texte', phrase)
    }
  }
  reconnaissance.onerror = (evenement) => {
    if (evenement.error !== 'aborted') erreur.value = MESSAGES_ERREUR[evenement.error] ?? 'La dictée s’est arrêtée. Réessayez.'
  }
  reconnaissance.onend = () => {
    ecoute.value = false
  }
  reconnaissance.start()
  ecoute.value = true
}

onUnmounted(arreter)
</script>

<template>
  <span v-if="disponible" class="dicter">
    <UiBouton
      type="button"
      size="sm"
      tertiary
      :icon="ecoute ? 'icone-stop-circle-line' : 'icone-mic-line'"
      :label="ecoute ? 'Arrêter la dictée' : 'Dicter'"
      :aria-controls="props.champ"
      title="L’audio est traité par le service de reconnaissance de votre navigateur"
      @click="basculer"
    />
    <span class="visuellement-cache" role="status">{{ ecoute ? 'Dictée en cours : parlez. Cliquez sur « Arrêter la dictée » pour finir.' : '' }}</span>
    <span v-if="erreur" class="champ__erreur texte-xs mt-0" role="alert">{{ erreur }}</span>
  </span>
</template>

<style scoped>
.dicter {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
}
</style>
