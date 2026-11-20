<script setup lang="ts">
import { computed, ref } from 'vue'
import BoutonDicter from '@/components/BoutonDicter.vue'
import { PROMPT_MAX, PROMPT_MIN } from '@/lib/story'

const props = defineProps<{ envoiEnCours?: boolean; erreurServeur?: string | null }>()
const emit = defineEmits<{ soumettre: [texte: string]; annuler: [] }>()

const texte = ref('')
const erreurLocale = ref('')
const erreur = computed(() => erreurLocale.value || props.erreurServeur || '')

/** Dictée : chaque phrase reconnue s'ajoute à la suite du texte. */
function ajouterDictee(phrase: string): void {
  texte.value = texte.value.trim() ? `${texte.value.trimEnd()} ${phrase}` : phrase
}

function envoyer(): void {
  const propre = texte.value.trim()
  if (propre.length < PROMPT_MIN) {
    erreurLocale.value = 'Décrivez votre demande en une phrase au moins'
    return
  }
  if (propre.length > PROMPT_MAX) {
    erreurLocale.value = `${PROMPT_MAX} caractères au maximum : pour une demande plus importante, écrivez des stories`
    return
  }
  erreurLocale.value = ''
  emit('soumettre', propre)
}
</script>

<template>
  <form novalidate @submit.prevent="envoyer">
    <h2 class="titre-4">Prompter (mode libre)</h2>
    <div class="encart mb-3w">
      <p class="encart__texte texte-sm">
        Pour un <strong>petit changement</strong> qui ne mérite pas une story : « mets le titre
        en bleu », « ajoute un lien vers le guide dans le pied de page »…
        <strong>Pas une application entière</strong> : pour une nouvelle fonctionnalité, écrivez
        une story. Si la demande est trop grosse, ADA vous proposera de la découper.
      </p>
      <p class="encart__texte texte-sm mt-1w">
        ADA vous propose ensuite un plan à valider avant de modifier quoi que ce soit.
      </p>
    </div>
    <UiChamp
      id="texte-prompt"
      v-model="texte"
      label="Votre demande"
      :hint="`Une ou quelques phrases (${PROMPT_MAX} caractères au maximum)`"
      label-visible
      is-textarea
      :error-message="erreur"
    />
    <BoutonDicter champ="texte-prompt" class="mb-2w" @texte="ajouterDictee" />
    <p class="texte-sm mb-2w" id="prompt-enregistrement">
      <span class="icone icone-information-line icone--sm" aria-hidden="true" />
      <strong>En envoyant, votre texte est enregistré tel quel sur GitHub, comme une demande
      « mode libre » du projet</strong> (une issue, visible par l’équipe). Elle apparaît dans la
      liste des demandes et garde la trace de tous les échanges.
    </p>
    <ul class="groupe-boutons">
      <li>
        <UiBouton
          aria-describedby="prompt-enregistrement"
          type="submit" :label="envoiEnCours ? 'Envoi…' : 'Envoyer à ADA'" :disabled="envoiEnCours" />
      </li>
      <li><UiBouton type="button" secondary label="Annuler" @click="emit('annuler')" /></li>
    </ul>
  </form>
</template>
