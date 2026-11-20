<script setup lang="ts">
import AvatarAda from '@/components/AvatarAda.vue'
import BoutonDicter from '@/components/BoutonDicter.vue'
import ContenuDemande from '@/components/ContenuDemande.vue'
import ConversationAda from '@/components/ConversationAda.vue'
import { api } from '@/services/api'
import { enStreaming, formaterCo2, type Empreinte } from '@/lib/empreinte'
import PropositionDecoupage from '@/components/PropositionDecoupage.vue'
import ReponseChoix from '@/components/ReponseChoix.vue'
import TexteRiche from '@/components/TexteRiche.vue'
import VerificationControles from '@/components/VerificationControles.vue'
import { computed, ref, watch } from 'vue'
import {
  aLancerOuRelancer,
  LIBELLES_STATUT,
  presenterMessage,
  lireChoix,
  lireDecoupage,
  lireStoriesParent,
  type StoryProposee,
  MARQUEUR_ASSISTANT,
  type Activite,
  type DetailStory,
  type Verification,
} from '@/lib/story'

const props = defineProps<{
  story: DetailStory
  /** Numéro et titre de la demande en cours sur le projet, s'il y en a une autre. */
  autreEnCours?: { numero: number; titre: string } | null
  activite?: Activite | null
  verification?: Verification | null
  erreurLancement?: string | null
  lancementEnCours?: boolean
  actionEnCours?: boolean
  /** Projet de la demande : pour lire son empreinte carbone estimée. */
  projet?: string | null
}>()
const emit = defineEmits<{
  lancer: []
  valider: []
  relancer: []
  fusionner: []
  relancerControles: []
  repondre: [texte: string]
  creerDecoupage: [stories: StoryProposee[]]
  envoyerMessage: [texte: string]
  terminerConversation: []
  arreterConversation: []
  ouvrir: [numero: number]
}>()

/** Pourquoi la demande ne peut pas être lancée, ou null si elle peut l'être. */
const blocage = computed(() => {
  if (!aLancerOuRelancer(props.story)) return null
  if (!props.story.prete) return `À corriger sur GitHub avant de la lancer : ${props.story.raison}.`
  if (props.autreEnCours)
    return `La demande #${props.autreEnCours.numero} « ${props.autreEnCours.titre} » est en cours : une seule à la fois.`
  return null
})

const messages = computed(() => props.story.messages.map((m) => ({ id: m.id, le: m.le, ...presenterMessage(m) })))

/** Commentaires écrits directement sur GitHub : ADA ne les lit pas, le PO doit répondre ici. */
const avisCommentairesIgnores = computed(() => {
  const nombre = props.story.commentairesIgnores ?? 0
  if (!nombre) return null
  return nombre === 1
    ? 'Un commentaire a été écrit directement sur GitHub. ADA ne le lit pas : si vous voulez qu’elle en tienne compte, recopiez-le ici.'
    : `${nombre} commentaires ont été écrits directement sur GitHub. ADA ne les lit pas : si vous voulez qu’elle en tienne compte, recopiez-les ici.`
})
const travaille = computed(() => props.activite?.enCours === true)

/** Empreinte carbone estimée de la demande : relue à l'ouverture, et quand ADA a fini un travail. */
const empreinte = ref<{ empreinte: Empreinte; equivalents: { streamingHeureG: number } } | null>(null)
async function lireEmpreinte(): Promise<void> {
  if (!props.projet) return
  try {
    empreinte.value = await api.lire(`/projets/${encodeURIComponent(props.projet)}/stories/${props.story.numero}/empreinte`)
  } catch {
    empreinte.value = null
  }
}
watch(
  () => [props.projet, props.story.numero, travaille.value] as const,
  ([, , enTravail]) => {
    if (!enTravail) void lireEmpreinte()
  },
  { immediate: true },
)
/** Conversation en cours (avant « c'est bon ») : tout le fil s'affiche, comme une discussion. */
const enConversation = computed(
  () => props.story.type === 'conversation' && ['en-cours', 'echange', 'besoin-dev'].includes(props.story.statut),
)
const dernieresActions = computed(() => (props.activite?.journal ?? []).slice(-8).reverse())

/** Champ de texte : réponse aux questions, ou modification demandée sur le plan. */
const modeModification = ref(false)
const replisOuverts = ref(-1)
const texte = ref('')
const erreur = ref('')
/** Dernier message de l'assistant (montré en entier sous l'action) ; le reste est l'historique, replié. */
const dernierMessage = computed(() => [...messages.value].reverse().find((message) => message.assistant) ?? null)
const historique = computed(() => messages.value.filter((message) => message.id !== dernierMessage.value?.id))
/** Une action est attendue du PO (sinon pas d'encart « À vous de jouer »). */
const actionAttendue = computed(
  () =>
    ['nouvelle', 'attente', 'en-verification', 'plan-a-valider', 'questions', 'decoupage', 'besoin-dev'].includes(props.story.statut) ||
    (props.story.statut === 'en-cours' && Boolean(props.activite)),
)

/** Choix joints par l'assistant à ses dernières questions : réponse en cases à cocher (#35). */
const questionsAChoix = computed(() => {
  if (props.story.statut !== 'questions') return []
  const dernier = [...props.story.messages].reverse().find((message) => message.texte.startsWith(MARQUEUR_ASSISTANT))
  return dernier ? lireChoix(dernier.texte) : []
})

const champVisible = computed(
  () =>
    !travaille.value &&
    (props.story.statut === 'questions' ||
      ((props.story.statut === 'plan-a-valider' || props.story.statut === 'decoupage') && modeModification.value)),
)

/** Découpage proposé par l'assistant (#36) : stories à cocher. */
const propositionDecoupage = computed(() => {
  if (props.story.statut !== 'decoupage') return []
  const dernier = [...props.story.messages].reverse().find((message) => message.texte.startsWith(MARQUEUR_ASSISTANT))
  return dernier ? lireDecoupage(dernier.texte) : []
})
/** Demande découpée : ses stories, cochées une fois livrées. */
const storiesParent = computed(() => lireStoriesParent(props.story.texteBrut ?? ''))

/** « de la story n° 12 », « du signalement n° 4 »… : où la réponse est enregistrée sur GitHub. */
const designation = computed(() => {
  const nature = { bug: 'du signalement', libre: 'de la demande', conversation: 'de la conversation', story: 'de la story' }[props.story.type]
  return `${nature} n° ${props.story.numero}`
})

const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** Dictée : chaque phrase reconnue s'ajoute à la suite du texte. */
function ajouterDictee(phrase: string): void {
  texte.value = texte.value.trim() ? `${texte.value.trimEnd()} ${phrase}` : phrase
}

function envoyer(): void {
  if (!texte.value.trim()) {
    erreur.value = props.story.statut === 'questions' ? 'Écrivez vos réponses avant d’envoyer' : 'Dites ce qu’il faut changer dans le plan'
    return
  }
  erreur.value = ''
  emit('repondre', texte.value.trim())
  texte.value = ''
  modeModification.value = false
}
</script>

<template>
  <article>
    <h2 class="titre-4 mb-1w">#{{ story.numero }} — {{ story.titre }}</h2>
    <p class="mb-2w">
      <UiBadge
        :label="LIBELLES_STATUT[story.statut].libelle"
        :type="LIBELLES_STATUT[story.statut].type"
        small
      />
      <a class="lien lien--sm ml-2w" :href="story.url" target="_blank" rel="noopener">
        Voir sur GitHub<span class="visuellement-cache"> (nouvelle fenêtre)</span>
      </a>
    </p>
    <UiAlerte v-if="avisCommentairesIgnores" type="info" small class="mb-2w" :description="avisCommentairesIgnores" />

    <!-- 1. Le dernier message de l'assistant, en entier, d'abord : c'est lui qui explique ce qu'on attend du PO. -->
    <ConversationAda
      v-if="enConversation"
      :story="story"
      :attend-reponse="story.statut === 'echange' && !travaille"
      :action-en-cours="actionEnCours"
      @envoyer="(message) => emit('envoyerMessage', message)"
      @terminer="emit('terminerConversation')"
      @arreter="emit('arreterConversation')"
      @creer-stories="(stories) => emit('creerDecoupage', stories)"
    />
    <section v-else-if="dernierMessage" class="mb-3w" aria-labelledby="titre-dernier-message">
      <h3 id="titre-dernier-message" class="titre-6 mb-1w">Dernier message d’ADA</h3>
      <div class="fil__assistant dernier-message">
        <p class="texte-xs mb-1v"><strong>{{ dernierMessage.auteur }}</strong> — {{ date(dernierMessage.le) }}</p>
        <TexteRiche :texte="dernierMessage.texte" />
      </div>
    </section>

    <!-- 2. Ce qu'on attend du PO, juste après l'explication : rien à chercher, rien à faire défiler. -->
    <section v-if="travaille" class="encart mb-3w activite" aria-labelledby="titre-action">
      <h3 id="titre-action" class="encart__titre titre-6">ADA travaille</h3>
      <div role="status" aria-live="polite">
        <p class="mb-1w">
          <span class="icone icone-refresh-line icone--sm activite__icone" aria-hidden="true" />
          <strong>
            ADA {{ activite?.phase === 'realisation' ? 'réalise la demande' : activite?.phase === 'conversation' ? 'travaille sur votre message' : 'analyse la demande' }}…
          </strong>
          <span v-if="activite?.phase === 'conversation'" class="texte-sm">
            L’aperçu montrera ses changements dès qu’elle aura répondu.
          </span>
          <span v-else-if="activite?.phase === 'realisation'" class="texte-sm">
            L’aperçu montre son travail en cours : ce n’est pas encore terminé. Vous serez prévenu
            ici quand ce sera prêt à vérifier.
          </span>
        </p>
        <ol v-if="dernieresActions.length" class="activite__journal texte-sm">
          <li v-for="action in dernieresActions" :key="action.le + action.texte">
            <span class="texte-xs">{{ heure(action.le) }}</span> {{ action.texte }}
          </li>
        </ol>
      </div>
    </section>

    <section v-else-if="actionAttendue" class="encart mb-3w a-vous" aria-labelledby="titre-action">
      <h3 id="titre-action" class="encart__titre titre-6">
        {{ story.statut === 'en-verification' ? 'À vous de vérifier' : 'À vous de jouer' }}
      </h3>

      <template v-if="aLancerOuRelancer(story)">
        <p v-if="story.statut === 'attente'" class="texte-sm">
          ADA a mis cette demande en attente : rien à construire pour l’instant. Relancez-la quand ce qu’elle attend sera livré.
        </p>
        <UiAlerte v-if="blocage" type="warning" small :description="blocage" />
        <template v-else>
          <UiBouton
            icon="icone-play-line"
            :label="lancementEnCours ? 'Lancement…' : story.type === 'bug' ? 'Lancer la correction' : story.statut === 'attente' ? 'Relancer cette story' : 'Lancer cette story'"
            aria-describedby="lancement-enregistrement"
            :disabled="lancementEnCours"
            @click="emit('lancer')"
          />
          <p id="lancement-enregistrement" class="texte-sm mt-1w mb-0">
            <span class="icone icone-information-line icone--sm" aria-hidden="true" />
            Le lancement est noté sur GitHub, à votre nom : un commentaire et le statut {{ designation }}.
          </p>
        </template>
        <UiAlerte v-if="erreurLancement" type="error" small :description="erreurLancement" class="mt-2w" />
      </template>

      <template v-else-if="story.statut === 'en-verification'">
        <VerificationControles
          :verification="verification"
          :action-en-cours="actionEnCours"
          @fusionner="emit('fusionner')"
          @relancer-controles="emit('relancerControles')"
        />
      </template>

      <template v-else-if="story.statut === 'en-cours' || story.statut === 'besoin-dev'">
        <p class="texte-sm mb-1w">
          {{ story.statut === 'besoin-dev' ? 'ADA est bloquée sur cette demande.' : 'ADA ne travaille pas sur cette demande en ce moment.' }}
        </p>
        <UiAlerte v-if="activite?.erreur" type="error" small :description="activite.erreur" class="mb-2w" />
        <UiBouton size="sm" secondary icon="icone-refresh-line" label="Relancer ADA" :disabled="actionEnCours" @click="emit('relancer')" />
      </template>

      <div v-else-if="story.statut === 'plan-a-valider' && !modeModification">
        <p class="texte-sm mb-2w">ADA attend votre accord sur le plan ci-dessus avant de commencer.</p>
        <p id="validation-enregistrement" class="texte-sm mb-2w">
          <span class="icone icone-information-line icone--sm" aria-hidden="true" />
          Votre accord est enregistré sur GitHub, en commentaire {{ designation }}, à votre nom.
        </p>
        <ul class="groupe-boutons">
          <li>
            <UiBouton icon="icone-check-line" label="Valider le plan" aria-describedby="validation-enregistrement" :disabled="actionEnCours" @click="emit('valider')" />
          </li>
          <li>
            <UiBouton secondary label="Demander une modification" :disabled="actionEnCours" @click="modeModification = true" />
          </li>
        </ul>
      </div>

      <PropositionDecoupage
        v-if="propositionDecoupage.length && !modeModification"
        :key="`decoupage-${story.messages.length}`"
        :stories="propositionDecoupage"
        :designation="`la demande n° ${story.numero}`"
        :action-en-cours="actionEnCours"
        @creer="(stories) => emit('creerDecoupage', stories)"
        @autre-decoupage="modeModification = true"
      />
      <ReponseChoix
        v-if="champVisible && questionsAChoix.length"
        :key="story.messages.length"
        :questions="questionsAChoix"
        :action-en-cours="actionEnCours"
        description-envoi="reponse-choix-enregistrement"
        @repondre="(reponse) => emit('repondre', reponse)"
      >
        <template #avant-envoi>
          <p id="reponse-choix-enregistrement" class="texte-sm mb-2w">
            <span class="icone icone-information-line icone--sm" aria-hidden="true" />
            <strong>En envoyant, vos réponses sont enregistrées sur GitHub, en commentaire
            {{ designation }}</strong>, à votre nom et visible par l’équipe du projet.
          </p>
        </template>
      </ReponseChoix>
      <form v-else-if="champVisible" novalidate class="mt-2w" @submit.prevent="envoyer">
        <p v-if="story.statut === 'questions'" class="texte-sm mb-2w">
          ADA attend vos réponses à ses questions ci-dessous pour continuer.
        </p>
        <UiChamp
          id="reponse-ada"
          v-model="texte"
          :label="story.statut === 'questions' ? 'Vos réponses' : story.statut === 'decoupage' ? 'Ce qu’il faut changer dans le découpage' : 'Ce qu’il faut changer dans le plan'"
          label-visible
          is-textarea
          :error-message="erreur"
        />
        <BoutonDicter champ="reponse-ada" class="mb-2w" @texte="ajouterDictee" />
        <p id="reponse-enregistrement" class="texte-sm mb-2w">
          <span class="icone icone-information-line icone--sm" aria-hidden="true" />
          <strong>En envoyant, votre texte est enregistré tel quel sur GitHub, en commentaire
          {{ designation }}</strong>, à votre nom et visible par l’équipe du projet. Il garde la trace
          des échanges avec ADA.
        </p>
        <ul class="groupe-boutons">
          <li><UiBouton type="submit" label="Envoyer" aria-describedby="reponse-enregistrement" :disabled="actionEnCours" /></li>
          <li v-if="modeModification">
            <UiBouton type="button" tertiary label="Annuler" @click="modeModification = false" />
          </li>
        </ul>
      </form>
    </section>

    <!-- 3. La demande elle-même. -->    <ContenuDemande :story="story" />

    <section v-if="storiesParent.length" class="mb-3w" aria-labelledby="titre-parent">
      <h3 id="titre-parent" class="titre-6 mb-1w">Découpée en {{ storiesParent.length }} stories</h3>
      <ul class="p-0 stories-parent">
        <li v-for="enfant in storiesParent" :key="enfant.numero" class="mb-1w">
          <UiBouton
            size="sm"
            tertiary
            :label="`#${enfant.numero} ${enfant.titre} — ${enfant.livree ? 'livrée' : 'à faire'}`"
            :icon="enfant.livree ? 'icone-checkbox-circle-line' : 'icone-time-line'"
            @click="emit('ouvrir', enfant.numero)"
          />
        </li>
      </ul>
    </section>

    <!-- 4. Le passé, replié : journal, demande de fusion, échanges dans l'ordre. -->
    <section v-if="story.statut !== 'nouvelle'" aria-labelledby="titre-suivi">
      <h3 id="titre-suivi" class="titre-6">Suivi</h3>
      <ol v-if="!travaille && dernieresActions.length" class="activite__journal texte-sm">
        <li v-for="action in dernieresActions" :key="action.le + action.texte">
          <span class="texte-xs">{{ heure(action.le) }}</span> {{ action.texte }}
        </li>
      </ol>
      <p v-if="empreinte" class="texte-xs mt-1w" data-testid="empreinte-demande">
        <span class="icone icone-leaf-line icone--sm" aria-hidden="true" />
        Empreinte estimée de cette demande : {{ formaterCo2(empreinte.empreinte.co2g) }}, soit
        {{ enStreaming(empreinte.empreinte.co2g, empreinte.equivalents.streamingHeureG) }}.
        <RouterLink to="/indicateurs">Comment c’est calculé</RouterLink>
      </p>
      <p v-if="activite?.pullRequest" class="mt-1w">
        <a class="lien" :href="activite.pullRequest" target="_blank" rel="noopener">
          Voir la demande de fusion (pull request) et ses contrôles<span class="visuellement-cache"> (nouvelle fenêtre)</span>
        </a>
      </p>
      <UiAccordeons v-model="replisOuverts" class="mb-2w">
        <UiAccordeon v-if="historique.length && story.type !== 'conversation'" id="historique" :title="`Voir l’historique (${historique.length} échange${historique.length > 1 ? 's' : ''})`">
          <ol class="fil">
            <li v-for="message in historique" :key="message.id" :class="{ 'fil__assistant': message.assistant }">
              <p class="texte-xs mb-1v">
                <strong>{{ message.auteur }}</strong> — {{ date(message.le) }}
              </p>
              <TexteRiche :texte="message.texte" />
            </li>
          </ol>
        </UiAccordeon>
        <UiAccordeon id="pourquoi-github" title="Pourquoi les échanges sont-ils enregistrés sur GitHub ?">
          <p class="texte-sm mb-1w">
            Vos réponses, votre accord sur le plan et les questions d’ADA sont recopiés en
            commentaires {{ designation }}. C’est un choix volontaire :
          </p>
          <ul class="texte-sm">
            <li><strong>Traçabilité</strong> : on sait qui a demandé quoi et qui a validé quel plan, quand. Important quand du code est écrit par une IA.</li>
            <li><strong>Un développeur peut reprendre</strong> en cas de blocage : tout le contexte est au même endroit.</li>
            <li><strong>L’historique appartient au projet</strong>, pas à ADA : il reste si l’outil change.</li>
          </ul>
          <p class="texte-sm mb-0">
            N’y écrivez donc rien de confidentiel. ADA garde sa propre trace des échanges : ce qui est
            écrit ou modifié directement sur GitHub ne lui parvient pas. Pour lui répondre, écrivez ici.
          </p>
        </UiAccordeon>
      </UiAccordeons>
    </section>
    <!-- Attaché à la page, pas à la colonne : la colonne qui défile seule ne le cache plus sous l'aperçu. -->
    <Teleport to="body">
      <AvatarAda v-if="travaille" :phase="activite?.phase" />
    </Teleport>
  </article>
</template>

<style scoped>
.stories-parent {
  list-style: none;
}
</style>
