<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '@/services/api'
import type { Projet } from '@/stores/projets'

/**
 * Annuler une reprise en attente, ou retirer un projet d'ADA (créé par elle ou repris). Rien n'est
 * supprimé sur GitHub :
 * une confirmation dit exactement ce qui va se passer avant d'agir.
 */
const props = defineProps<{ projet: Projet }>()
const emit = defineEmits<{ fait: [etat: 'annulee' | 'desynchronisee'] }>()

const confirmation = ref(false)
const enCours = ref(false)
const erreur = ref<string | null>(null)
const enAttente = computed(() => props.projet.reprise !== null)
const libelle = computed(() => (enAttente.value ? 'Annuler la reprise' : 'Retirer d’ADA'))

async function confirmer(): Promise<void> {
  enCours.value = true
  erreur.value = null
  try {
    const { etat } = await api.envoyer<{ etat: 'annulee' | 'desynchronisee' }>(
      `/projets/${encodeURIComponent(props.projet.id)}/reprise/annuler`,
      {},
    )
    confirmation.value = false
    emit('fait', etat)
  } catch (e) {
    erreur.value = (e as Error).message
  } finally {
    enCours.value = false
  }
}
</script>

<template>
  <UiBouton
    v-if="!confirmation"
    size="sm"
    tertiary
    icon="icone-close-circle-line"
    :label="libelle"
    @click="confirmation = true"
  />
  <div v-else class="encart mt-2w mb-2w" role="group" aria-labelledby="titre-annuler-reprise">
    <h2 id="titre-annuler-reprise" class="encart__titre titre-6">{{ libelle }} « {{ projet.nom }} » ?</h2>
    <p v-if="enAttente" class="encart__texte texte-sm">
      La reprise n’est pas encore validée : ADA ferme sa pull request et sa branche, et clôt la
      demande d’analyse. Le projet n’a jamais été modifié et disparaît d’ADA. Vous pourrez le
      reprendre plus tard.
    </p>
    <p v-else class="encart__texte texte-sm">
      Le projet disparaît d’ADA, mais rien n’est supprimé sur GitHub : le dépôt, ses stories, ses
      versions et les fichiers ajoutés par ADA restent. Vous pourrez le faire revenir avec
      « Reprendre un projet ».
    </p>
    <UiAlerte v-if="erreur" type="error" small :description="erreur" class="mb-2w" />
    <ul class="groupe-boutons groupe-boutons--sm">
      <li><UiBouton :label="enCours ? 'En cours…' : enAttente ? 'Confirmer l’annulation' : 'Confirmer le retrait'" :disabled="enCours" @click="confirmer" /></li>
      <li><UiBouton secondary label="Garder le projet dans ADA" :disabled="enCours" @click="confirmation = false" /></li>
    </ul>
  </div>
</template>
