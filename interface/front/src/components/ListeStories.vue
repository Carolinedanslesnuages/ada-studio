<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LIBELLES_STATUT, aLancerOuRelancer, ordonnerALancer, type ResumeStory } from '@/lib/story'

/**
 * Stories du projet : celles en cours (avec l'assistant, à vérifier…) restent visibles ; celles
 * à lancer sont rangées dans un accordéon, pour ne pas faire défiler l'écran quand il y en a beaucoup.
 */
const props = defineProps<{ stories: ResumeStory[]; numeroCourant?: number | null }>()
const emit = defineEmits<{ ouvrir: [numero: number] }>()

const enCours = computed(() => props.stories.filter((story) => !aLancerOuRelancer(story)))
/** Dans l'ordre conseillé par ADA ; la première prête est la prochaine à lancer. */
const aLancer = computed(() => ordonnerALancer(props.stories.filter(aLancerOuRelancer)))
const prochaine = computed(() => aLancer.value.find((story) => story.prete && story.statut === 'nouvelle') ?? null)
const titreALancer = computed(() => `À lancer (${aLancer.value.length})`)

/** Fermé par défaut ; ouvert d'office quand la story affichée en fait partie. */
const accordeonOuvert = ref(-1)
watch(
  () => props.numeroCourant,
  (numero) => {
    if (numero && aLancer.value.some((story) => story.numero === numero)) accordeonOuvert.value = 0
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <ul v-if="enCours.length > 0" class="liste-stories" aria-label="Stories en cours">
      <li v-for="story in enCours" :key="story.numero">
        <button
          type="button"
          :aria-current="story.numero === numeroCourant ? 'true' : undefined"
          @click="emit('ouvrir', story.numero)"
        >
          <span>
            <span class="texte-xs mb-0">#{{ story.numero }}</span>
            <span v-if="story.type === 'bug'" class="texte-xs mb-0"> Problème :</span>
            <span v-else-if="story.type === 'libre'" class="texte-xs mb-0"> Mode libre :</span>
            {{ story.titre }}
          </span>
          <UiBadge
            :label="LIBELLES_STATUT[story.statut].libelle"
            :type="LIBELLES_STATUT[story.statut].type"
            small
            no-icon
          />
        </button>
      </li>
    </ul>

    <div v-if="prochaine" class="prochaine-story mt-2w">
      <p class="texte-sm texte-gras mb-1v">Prochaine story conseillée</p>
      <button
        type="button"
        class="prochaine-story__bouton"
        :aria-current="prochaine.numero === numeroCourant ? 'true' : undefined"
        @click="emit('ouvrir', prochaine.numero)"
      >
        <span class="texte-xs mb-0">#{{ prochaine.numero }}</span>
        <span v-if="prochaine.type === 'bug'" class="texte-xs mb-0"> Problème :</span>
        {{ prochaine.titre }}
      </button>
    </div>

    <UiAccordeons v-if="aLancer.length > 0" v-model="accordeonOuvert" class="mt-1w">
      <UiAccordeon id="stories-a-lancer" :title="titreALancer">
        <p class="texte-xs mb-1w">
          Dans l’ordre conseillé par ADA : les stories prêtes d’abord, les problèmes signalés en
          premier, puis l’ordre de chaque découpage, enfin les plus anciennes.
        </p>
        <ol class="liste-stories" aria-label="Stories à lancer, dans l’ordre conseillé">
          <li v-for="story in aLancer" :key="story.numero">
            <button
              type="button"
              :aria-current="story.numero === numeroCourant ? 'true' : undefined"
              @click="emit('ouvrir', story.numero)"
            >
              <span>
                <span class="texte-xs mb-0">#{{ story.numero }}</span>
                <span v-if="story.type === 'bug'" class="texte-xs mb-0"> Problème :</span>
                <span v-else-if="story.type === 'libre'" class="texte-xs mb-0"> Mode libre :</span>
                {{ story.titre }}
              </span>
              <UiBadge
                v-if="!story.prete"
                label="À corriger sur GitHub"
                type="warning"
                small
                no-icon
              />
              <UiBadge
                v-else
                :label="LIBELLES_STATUT[story.statut].libelle"
                :type="LIBELLES_STATUT[story.statut].type"
                small
                no-icon
              />
            </button>
          </li>
        </ol>
      </UiAccordeon>
    </UiAccordeons>
  </div>
</template>

<style scoped>
.prochaine-story__bouton {
  width: 100%;
  text-align: left;
  padding: 0.75rem;
  border: 1px solid var(--app-primaire);
  background-color: var(--app-fond-primaire);
  cursor: pointer;
}
.prochaine-story__bouton[aria-current='true'] {
  box-shadow: inset 4px 0 0 var(--app-primaire);
}
</style>
