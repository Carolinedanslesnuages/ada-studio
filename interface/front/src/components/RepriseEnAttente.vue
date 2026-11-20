<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { api } from '@/services/api'
import { LIBELLES_CONTROLE, type Verification } from '@/lib/story'

/**
 * Projet en cours de reprise (#37) : l'assistant l'analyse, puis le PO valide la PR de reprise
 * ici même. Ses propositions d'amélioration sont dans la demande d'analyse, dans la liste.
 */
type EtatReprise = Verification & { analyseEnCours: boolean }

const props = defineProps<{ projet: string; intervalleSuivi?: number }>()
const emit = defineEmits<{ fusionnee: [] }>()

const etat = ref<EtatReprise | null>(null)
const erreur = ref<string | null>(null)
const fusionEnCours = ref(false)
let minuteur: ReturnType<typeof setInterval> | null = null
const chemin = () => `/projets/${encodeURIComponent(props.projet)}/reprise`

async function charger(): Promise<void> {
  try {
    etat.value = await api.lire<EtatReprise>(chemin())
    erreur.value = null
  } catch (e) {
    erreur.value = (e as Error).message
  }
}

async function relancerControles(): Promise<void> {
  fusionEnCours.value = true
  try {
    etat.value = await api.envoyer<EtatReprise>(`${chemin()}/controles/relancer`, {})
  } catch (e) {
    erreur.value = (e as Error).message
  } finally {
    fusionEnCours.value = false
  }
}

async function fusionner(): Promise<void> {
  fusionEnCours.value = true
  try {
    etat.value = await api.envoyer<EtatReprise>(`${chemin()}/fusionner`, {})
    emit('fusionnee')
  } catch (e) {
    erreur.value = (e as Error).message
  } finally {
    fusionEnCours.value = false
  }
}

function suivre(): void {
  if (minuteur) clearInterval(minuteur)
  void charger()
  minuteur = setInterval(() => void charger(), props.intervalleSuivi ?? 10000)
}
onMounted(suivre)
watch(() => props.projet, suivre)
onUnmounted(() => {
  if (minuteur) clearInterval(minuteur)
})
</script>

<template>
  <section class="mb-3w" aria-labelledby="titre-reprise-attente">
    <h2 id="titre-reprise-attente" class="titre-6 mb-1w">Reprise du projet</h2>
    <div role="status">
      <p v-if="!etat && !erreur" class="texte-sm">Chargement de la reprise…</p>
      <UiAlerte
        v-else-if="etat?.analyseEnCours && !etat.pullRequest"
        type="info"
        small
        description="ADA analyse le projet comme si elle l’avait créé (quelques minutes). Suivez-la dans la demande d’analyse ci-dessous : elle y proposera ses améliorations, puis la reprise sera à valider ici."
      />
      <UiAlerte
        v-else-if="etat && !etat.pullRequest"
        type="warning"
        small
        description="L’analyse s’est arrêtée sans pull request de reprise : ADA explique pourquoi dans la demande d’analyse ci-dessous."
      />
      <UiAlerte
        v-else-if="etat?.pullRequest?.etat === 'fusionnee'"
        type="success"
        small
        description="Reprise validée : le projet suit maintenant les règles d’ADA. Choisissez les améliorations à publier dans la demande d’analyse."
      />
      <UiAlerte
        v-else-if="etat?.pullRequest"
        type="info"
        small
        description="À vous de valider la reprise : ADA ajoute au projet les formulaires de story, la description de l’aperçu et les versions automatiques. Les demandes pourront être lancées ensuite."
      />
    </div>
    <UiAlerte v-if="erreur" type="error" small :description="erreur" class="mt-1w" />

    <template v-if="etat?.pullRequest && etat.pullRequest.etat === 'ouverte'">
      <ul class="mt-1w mb-1w texte-sm">
        <li v-for="controle in etat.controles" :key="controle.nom">{{ controle.nom }} : {{ LIBELLES_CONTROLE[controle.etat] }}</li>
      </ul>
      <p v-if="!etat.fusionnable && etat.raison" class="texte-sm">{{ etat.raison }}</p>
      <ul class="groupe-boutons groupe-boutons--sm">
        <li>
          <UiBouton label="Valider et fusionner la reprise" :disabled="!etat.fusionnable || fusionEnCours" @click="fusionner" />
        </li>
        <li v-if="etat.controles.some((controle) => controle.etat === 'non-lance')">
          <UiBouton secondary icon="icone-refresh-line" label="Relancer les contrôles" :disabled="fusionEnCours" @click="relancerControles" />
        </li>
        <li>
          <a class="bouton bouton--secondaire bouton--sm" :href="etat.pullRequest.url" target="_blank" rel="noopener">
            Voir la pull request <span class="visuellement-cache">(nouvelle fenêtre)</span>
          </a>
        </li>
      </ul>
    </template>
  </section>
</template>
