<script setup lang="ts">
import { computed, ref } from 'vue'
import BoutonDicter from '@/components/BoutonDicter.vue'
import EmpreinteProjet from '@/components/EmpreinteProjet.vue'
import { MESSAGE_MAX, aLancerOuRelancer, ordonnerALancer, type ResumeStory } from '@/lib/story'

/**
 * Accueil d'un projet, façon Gemini : une grande zone « Que fait-on ? » qui ouvre une conversation
 * avec ADA, et quelques suggestions (la story conseillée, une demande guidée).
 */
const props = defineProps<{
  nomProjet: string
  /** Identifiant du projet : pour lire son empreinte carbone estimée. */
  projet?: string | null
  stories: ResumeStory[]
  /** Demande en cours : une seule à la fois, on propose d'y aller plutôt que d'en ouvrir une autre. */
  active: ResumeStory | null
  envoiEnCours?: boolean
  erreurServeur?: string | null
}>()
const emit = defineEmits<{ conversation: [texte: string]; ouvrir: [numero: number]; guidee: [] }>()

const conseillee = computed(() => ordonnerALancer(props.stories.filter(aLancerOuRelancer)).find((story) => story.prete && story.statut === 'nouvelle') ?? null)

const texte = ref('')
const erreurLocale = ref('')
const erreur = computed(() => erreurLocale.value || props.erreurServeur || '')

function envoyer(): void {
  const propre = texte.value.trim()
  if (propre.length < 10) {
    erreurLocale.value = 'Dites à ADA ce que vous voulez faire, en une phrase au moins'
    return
  }
  if (propre.length > MESSAGE_MAX) {
    erreurLocale.value = `${MESSAGE_MAX} caractères au maximum par message : envoyez la suite dans un autre message`
    return
  }
  erreurLocale.value = ''
  emit('conversation', propre)
}

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
</script>

<template>
  <section class="accueil" aria-labelledby="titre-accueil">
    <h2 id="titre-accueil" class="accueil__titre">Que fait-on sur {{ nomProjet }} ?</h2>

    <div v-if="active" class="encart accueil__occupe">
      <p class="encart__texte texte-sm">
        <strong>#{{ active.numero }} « {{ active.titre }} »</strong> est en cours : une demande à la fois.
      </p>
      <UiBouton size="sm" secondary label="Y aller" @click="emit('ouvrir', active.numero)" />
    </div>

    <form v-else novalidate class="saisie" @submit.prevent="envoyer">
      <label class="visuellement-cache" for="message-accueil">Votre message à ADA</label>
      <textarea
        id="message-accueil"
        v-model="texte"
        class="saisie__texte"
        rows="3"
        placeholder="Décrivez ce que vous voulez : une page, un changement, une question…"
        :aria-describedby="erreur ? 'erreur-accueil aide-accueil' : 'aide-accueil'"
        :aria-invalid="erreur ? 'true' : undefined"
        @keydown="touche"
      />
      <div class="saisie__bas">
        <p id="aide-accueil" class="texte-xs mb-0">
          ADA agit tout de suite sur une copie à part. Rien n’arrive sur le projet avant votre « c’est bon ».
        </p>
        <span class="saisie__actions">
          <BoutonDicter champ="message-accueil" @texte="ajouterDictee" />
          <UiBouton type="submit" icon="icone-send-plane-fill" :label="envoiEnCours ? 'Envoi…' : 'Envoyer'" :disabled="envoiEnCours" />
        </span>
      </div>
      <p v-if="erreur" id="erreur-accueil" class="champ__erreur mt-1w" role="alert">{{ erreur }}</p>
    </form>

    <ul v-if="!active" class="suggestions" aria-label="Suggestions">
      <li v-if="conseillee">
        <button type="button" class="suggestion" @click="emit('ouvrir', conseillee.numero)">
          <span class="icone icone-play-line icone--sm" aria-hidden="true" />
          Story conseillée : #{{ conseillee.numero }} {{ conseillee.titre }}
        </button>
      </li>
      <li>
        <button type="button" class="suggestion" @click="emit('guidee')">
          <span class="icone icone-list-ordered icone--sm" aria-hidden="true" />
          Demande guidée, avec un plan à valider
        </button>
      </li>
    </ul>

    <EmpreinteProjet v-if="projet" :projet="projet" />
  </section>
</template>

<style scoped>
.accueil {
  max-width: 44rem;
  margin: 12vh auto 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.accueil__titre {
  font-size: 1.75rem;
  text-align: center;
  margin: 0;
}

.saisie {
  border: 1px solid var(--app-bordure);
  border-radius: 1rem;
  padding: 0.75rem 0.75rem 0.5rem 1rem;
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

.saisie__bas {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.saisie__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.suggestions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.suggestions li {
  padding: 0;
}

.suggestion {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--app-bordure);
  border-radius: 2rem;
  background: var(--app-fond);
  font-size: 0.875rem;
  cursor: pointer;
}

.suggestion:hover {
  background: var(--app-fond-survol);
}

.accueil__occupe :deep(button) {
  flex-shrink: 0;
  white-space: nowrap;
}

.accueil__occupe {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
</style>
