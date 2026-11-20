<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { CRITERES_MAX, type StoryProposee } from '@/lib/story'

/**
 * Découpage proposé par l'assistant (#36) : chaque story est préremplie et repliée (seul son titre
 * se lit d'un coup d'œil). Le PO coche celles à publier, corrige s'il le souhaite, puis valide :
 * ADA les publie sur GitHub à son nom. Une story qui recoupe une story déjà écrite arrive décochée,
 * avec un avertissement : un PO pressé ne publie pas un doublon sans le voir.
 */
const props = withDefaults(
  defineProps<{
    stories: StoryProposee[]
    designation: string
    actionEnCours?: boolean
    /** Faux en conversation : pour d'autres stories, le PO répond simplement à ADA. */
    autreDecoupage?: boolean
  }>(),
  { autreDecoupage: true },
)
const emit = defineEmits<{ creer: [stories: StoryProposee[]]; autreDecoupage: [] }>()

/** Champs modifiables, préremplis ; les critères s'écrivent un par ligne. */
const brouillons = reactive(
  props.stories.map((story) => ({
    publier: !story.doublonDe,
    doublonDe: story.doublonDe ?? null,
    titre: story.titre,
    role: story.role,
    besoin: story.besoin,
    benefice: story.benefice,
    criteres: story.criteres.join('\n'),
  })),
)
const ouverte = ref(-1)
const doublons = brouillons.filter((brouillon) => brouillon.doublonDe).length
const erreurs = ref<string[]>([])
const nombre = computed(() => brouillons.filter((brouillon) => brouillon.publier).length)
const libelleBouton = computed(() => (nombre.value > 1 ? `Publier les ${nombre.value} stories sur GitHub` : 'Publier la story sur GitHub'))
const erreurGenerale = ref('')

const lignes = (texte: string) =>
  texte
    .split('\n')
    .map((ligne) => ligne.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)

function verifier(brouillon: (typeof brouillons)[number]): string {
  if (!brouillon.publier) return ''
  const manque = [
    !brouillon.titre.trim() && 'le titre',
    !brouillon.role.trim() && '« en tant que »',
    !brouillon.besoin.trim() && '« je veux »',
    !brouillon.benefice.trim() && '« afin de »',
  ].filter(Boolean)
  if (manque.length) return `Complétez ${manque.join(', ')}`
  const nombreCriteres = lignes(brouillon.criteres).length
  if (nombreCriteres < 1 || nombreCriteres > CRITERES_MAX) return `De 1 à ${CRITERES_MAX} critères d’acceptation, un par ligne`
  return ''
}

function publier(): void {
  erreurs.value = brouillons.map(verifier)
  erreurGenerale.value = nombre.value ? '' : 'Cochez au moins une story'
  const premiereErreur = erreurs.value.findIndex(Boolean)
  if (premiereErreur >= 0) ouverte.value = premiereErreur
  if (erreurGenerale.value || premiereErreur >= 0) return
  emit(
    'creer',
    brouillons
      .filter((brouillon) => brouillon.publier)
      .map((brouillon) => ({
        titre: brouillon.titre.trim(),
        role: brouillon.role.trim(),
        besoin: brouillon.besoin.trim(),
        benefice: brouillon.benefice.trim(),
        criteres: lignes(brouillon.criteres),
      })),
  )
}
</script>

<template>
  <form novalidate class="mt-2w" aria-labelledby="titre-decoupage" @submit.prevent="publier">
    <h4 id="titre-decoupage" class="titre-6 mb-1w">Stories proposées</h4>
    <p class="texte-sm">Cochez celles à publier. Ouvrez une story pour la relire ou la corriger.</p>
    <UiAlerte
      v-if="doublons"
      type="warning"
      small
      class="mb-2w"
      :description="doublons > 1 ? `${doublons} stories ressemblent à des stories déjà écrites : je ne les ai pas cochées.` : 'Une story ressemble à une story déjà écrite : je ne l’ai pas cochée.'"
    />

    <ul class="p-0 decoupage">
      <li v-for="(brouillon, rang) in brouillons" :key="rang" class="mb-2w">
        <div class="choix">
          <input
            :id="`story-proposee-${rang}`"
            v-model="brouillon.publier"
            type="checkbox"
            :aria-describedby="brouillon.doublonDe ? `story-proposee-${rang}-doublon` : undefined"
          />
          <label class="champ__etiquette" :for="`story-proposee-${rang}`">Publier « {{ brouillon.titre || 'sans titre' }} »</label>
        </div>
        <p v-if="brouillon.doublonDe" :id="`story-proposee-${rang}-doublon`" class="message message--avertissement mt-1v">
          Ressemble à la story n° {{ brouillon.doublonDe }}, déjà dans le projet. Cochez-la seulement si ce n’est pas la même chose.
        </p>
        <p v-if="erreurs[rang]" class="champ__erreur mt-1v" role="alert">Story {{ rang + 1 }} : {{ erreurs[rang] }}</p>
        <UiAccordeons v-model="ouverte">
          <UiAccordeon :id="`story-proposee-${rang}-detail`" :title="`Relire ou modifier la story ${rang + 1}`">
            <UiChamp v-model="brouillon.titre" :label="`Titre (story ${rang + 1})`" label-visible />
            <UiChamp v-model="brouillon.role" :label="`En tant que (story ${rang + 1})`" label-visible />
            <UiChamp v-model="brouillon.besoin" :label="`Je veux (story ${rang + 1})`" label-visible is-textarea />
            <UiChamp v-model="brouillon.benefice" :label="`Afin de (story ${rang + 1})`" label-visible is-textarea />
            <UiChamp
              v-model="brouillon.criteres"
              :label="`Critères d’acceptation (story ${rang + 1})`"
              :hint="`Un par ligne, ${CRITERES_MAX} au maximum`"
              label-visible
              is-textarea
            />
          </UiAccordeon>
        </UiAccordeons>
      </li>
    </ul>

    <p v-if="erreurGenerale" class="champ__erreur" role="alert">{{ erreurGenerale }}</p>
    <p id="decoupage-enregistrement" class="texte-sm mb-2w">
      <span class="icone icone-information-line icone--sm" aria-hidden="true" />
      <strong>ADA publiera ces stories sur GitHub, à votre nom</strong>, reliées à {{ designation }}.
    </p>
    <ul class="groupe-boutons">
      <li><UiBouton type="submit" :label="libelleBouton" aria-describedby="decoupage-enregistrement" :disabled="actionEnCours" /></li>
      <li v-if="autreDecoupage">
        <UiBouton type="button" secondary label="Demander un autre découpage" :disabled="actionEnCours" @click="emit('autreDecoupage')" />
      </li>
    </ul>
  </form>
</template>

<style scoped>
.decoupage {
  list-style: none;
}
</style>
