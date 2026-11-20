<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import TableauDonnees from '@/components/ui/TableauDonnees.vue'
import { ADRESSE_EXPORT_CSV, lireReponses, type Reponse, type Valeur } from '@/services/formulaire'
import { useFormulaireStore } from '@/stores/formulaire'

const magasin = useFormulaireStore()
const { formulaire } = storeToRefs(magasin)
const reponses = ref<Reponse[] | null>(null)
const erreur = ref<string | null>(null)

onMounted(async () => {
  try {
    await magasin.charger()
    reponses.value = await lireReponses()
  } catch {
    erreur.value = 'Les réponses n’ont pas pu être chargées. Réessayez dans quelques instants.'
  }
})

const dateLisible = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' })
const texte = (valeur: Valeur | undefined) => (Array.isArray(valeur) ? valeur.join(', ') : String(valeur ?? ''))

const colonnes = computed(() => [
  { cle: 'numero', libelle: 'N°' },
  { cle: 'recueLe', libelle: 'Reçue le' },
  ...(formulaire.value?.questions.map((question) => ({ cle: `question-${question.id}`, libelle: question.libelle })) ?? []),
])
const lignes = computed(() =>
  (reponses.value ?? []).map((reponse) => ({
    numero: String(reponse.id),
    recueLe: dateLisible(reponse.recueillieLe),
    ...Object.fromEntries(
      formulaire.value?.questions.map((question) => [`question-${question.id}`, texte(reponse.valeurs[question.id])]) ?? [],
    ),
  })),
)
</script>

<template>
  <h1>Réponses</h1>
  <div v-if="erreur" class="alerte alerte--erreur" role="alert">
    <p class="alerte__titre">Réponses indisponibles</p>
    <p>{{ erreur }}</p>
  </div>
  <p v-else-if="reponses === null" role="status">Chargement des réponses…</p>
  <template v-else>
    <p role="status">{{ reponses.length }} réponse(s) reçue(s).</p>
    <p v-if="reponses.length > 0">
      <a class="lien-bouton" :href="ADRESSE_EXPORT_CSV" download>Exporter les réponses (CSV, séparateur point-virgule)</a>
    </p>
    <TableauDonnees
      v-if="reponses.length > 0"
      titre="Réponses reçues, de la plus récente à la plus ancienne"
      :colonnes="colonnes"
      :lignes="lignes"
    />
  </template>
</template>
