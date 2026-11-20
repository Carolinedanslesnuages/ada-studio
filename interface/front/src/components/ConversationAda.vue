<script setup lang="ts">
import BoutonDicter from '@/components/BoutonDicter.vue'
import PropositionDecoupage from '@/components/PropositionDecoupage.vue'
import TexteRiche from '@/components/TexteRiche.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { lireDecoupage, MARQUEUR_ASSISTANT, MARQUEUR_LANCEMENT, MESSAGE_MAX, presenterMessage, type DetailStory, type StoryProposee } from '@/lib/story'

/**
 * Conversation (« vrai prompt ») : tous les échanges dans l'ordre, puis, quand ADA a répondu, le
 * message suivant du PO, « c'est bon » (proposer les changements au projet) ou « arrêter ». Des stories
 * pour plus tard proposées par ADA dans son dernier message se choisissent ici ; ADA les publie.
 */
const props = defineProps<{ story: DetailStory; attendReponse: boolean; actionEnCours?: boolean }>()
const emit = defineEmits<{ envoyer: [texte: string]; terminer: []; arreter: []; creerStories: [stories: StoryProposee[]] }>()

/** Stories proposées par ADA dans son dernier message (une fois publiées, le message suivant les retire). */
const storiesProposees = computed(() => {
  const dernier = props.story.messages[props.story.messages.length - 1]
  return dernier?.texte.startsWith(MARQUEUR_ASSISTANT) ? lireDecoupage(dernier.texte) : []
})

const echanges = computed(() => [
  ...(props.story.contenuLibre ? [{ id: 0, auteur: 'Vous', texte: props.story.contenuLibre, assistant: false, le: props.story.creeeLe }] : []),
  ...props.story.messages
    .filter((message) => !message.texte.startsWith(MARQUEUR_LANCEMENT))
    .map((message) => ({ id: message.id, le: message.le, ...presenterMessage(message) })),
])

/* Comme dans une messagerie : on arrive sur le dernier message, et on y revient à chaque réponse. */
const liste = ref<HTMLOListElement | null>(null)
watch(
  () => echanges.value.length,
  async () => {
    await nextTick()
    liste.value?.lastElementChild?.scrollIntoView?.({ block: 'nearest' })
  },
  { immediate: true },
)

const texte = ref('')
const erreur = ref('')
const confirmerArret = ref(false)
const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** Dictée : chaque phrase reconnue s'ajoute à la suite du message. */
function ajouterDictee(phrase: string): void {
  texte.value = texte.value.trim() ? `${texte.value.trimEnd()} ${phrase}` : phrase
}

/** Entrée envoie, Maj+Entrée va à la ligne : comme dans les messageries. */
function touche(evenement: KeyboardEvent): void {
  if (evenement.key === 'Enter' && !evenement.shiftKey && !evenement.isComposing) {
    evenement.preventDefault()
    envoyer()
  }
}

function envoyer(): void {
  const propre = texte.value.trim()
  if (!propre) {
    erreur.value = 'Écrivez votre message à ADA'
    return
  }
  if (propre.length > MESSAGE_MAX) {
    erreur.value = `${MESSAGE_MAX} caractères au maximum par message : envoyez la suite dans un autre message`
    return
  }
  erreur.value = ''
  emit('envoyer', propre)
  texte.value = ''
}
</script>

<template>
  <section class="mb-1w" aria-labelledby="titre-conversation">
    <h3 id="titre-conversation" class="titre-6 mb-1w">Conversation avec ADA</h3>
    <ol ref="liste" class="fil conversation">
      <li v-for="message in echanges" :key="message.id" :class="{ fil__assistant: message.assistant, conversation__po: !message.assistant }">
        <p class="texte-xs mb-1v">
          <strong>{{ message.assistant ? 'ADA' : message.auteur }}</strong> — {{ date(message.le) }}
        </p>
        <TexteRiche :texte="message.texte" />
      </li>
    </ol>

    <PropositionDecoupage
      v-if="attendReponse && storiesProposees.length"
      :key="`stories-${story.messages.length}`"
      class="mb-2w"
      :stories="storiesProposees"
      :designation="`la conversation n° ${story.numero}`"
      :action-en-cours="actionEnCours"
      :autre-decoupage="false"
      @creer="(stories) => emit('creerStories', stories)"
    />

    <div v-if="attendReponse" class="zone-message">
      <form novalidate class="saisie" @submit.prevent="envoyer">
        <label class="visuellement-cache" for="message-conversation">Votre message à ADA</label>
        <textarea
          id="message-conversation"
          v-model="texte"
          class="saisie__texte"
          rows="2"
          placeholder="Répondez à ADA, demandez un autre changement…"
          :aria-describedby="erreur ? 'erreur-conversation message-enregistrement' : 'message-enregistrement'"
          :aria-invalid="erreur ? 'true' : undefined"
          @keydown="touche"
        />
        <div class="saisie__bas">
          <p id="message-enregistrement" class="texte-xs mb-0">Enregistré sur GitHub, à votre nom.</p>
          <span class="saisie__actions">
            <BoutonDicter champ="message-conversation" @texte="ajouterDictee" />
            <UiBouton type="submit" icon="icone-send-plane-fill" label="Envoyer" :disabled="actionEnCours" />
          </span>
        </div>
      </form>
      <p v-if="erreur" id="erreur-conversation" class="champ__erreur mt-1w" role="alert">{{ erreur }}</p>

      <div v-if="!confirmerArret" class="conclure">
        <UiBouton
          size="sm"
          secondary
          icon="icone-check-line"
          label="C’est bon : proposer ces changements"
          title="ADA propose ses changements au projet : ils passent les contrôles, puis vous les ajoutez"
          :disabled="actionEnCours"
          @click="emit('terminer')"
        />
        <UiBouton size="sm" tertiary no-outline label="Arrêter la conversation" :disabled="actionEnCours" @click="confirmerArret = true" />
      </div>
      <div v-else class="conclure" role="group" aria-labelledby="arret-question">
        <p id="arret-question" class="texte-sm mb-0">
          <strong>Arrêter ?</strong> Rien de ce qu’ADA a fait ne sera ajouté au projet.
        </p>
        <UiBouton size="sm" label="Oui, arrêter" :disabled="actionEnCours" @click="emit('arreter')" />
        <UiBouton size="sm" secondary label="Non, continuer" @click="confirmerArret = false" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.conversation__po {
  margin-left: 2rem;
}

/* La zone de message reste collée en bas pendant qu'on relit la conversation. */
.zone-message {
  position: sticky;
  bottom: 0;
  z-index: 1;
  padding: 0.75rem 0 0.5rem;
  background: var(--app-fond);
}

.saisie {
  border: 1px solid var(--app-bordure);
  border-radius: 1rem;
  padding: 0.5rem 0.5rem 0.375rem 0.875rem;
  background: var(--app-fond);
  box-shadow: 0 2px 8px rgb(0 0 18 / 8%);
}

.saisie:focus-within {
  outline: 2px solid #0a76f6;
  outline-offset: 2px;
}

.saisie__texte {
  width: 100%;
  border: 0;
  resize: vertical;
  background: transparent;
  font: inherit;
  outline: none;
}

.saisie__bas,
.conclure {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.saisie__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.conclure {
  justify-content: flex-start;
  margin-top: 0.5rem;
}
</style>
