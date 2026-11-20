<script setup lang="ts">
import { computed, ref } from 'vue'
import { enAmpoule, equivalentsParlants, formaterCo2, formaterEnergie, type EmpreinteAda } from '@/lib/empreinte'

/**
 * Empreinte carbone estimée de l'usage d'ADA : en fourchette, avec des équivalents officiels de
 * l'ADEME, et la méthode, les hypothèses et les limites dites franchement.
 */
const props = defineProps<{ empreinte: EmpreinteAda }>()

const ouvert = ref(-1)
const entetes = ['Projet', 'Émissions estimées', 'Soit']
const lignes = computed(() =>
  props.empreinte.parProjet.map(({ projet, empreinte }) => [projet, formaterCo2(empreinte.co2g), equivalentsParlants(empreinte.co2g, props.empreinte.equivalents)[0]]),
)
const parlants = computed(() => equivalentsParlants(props.empreinte.total.co2g, props.empreinte.equivalents))
const depuis = computed(() => (props.empreinte.depuis ? new Date(props.empreinte.depuis).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : null))
const nombreFr = (valeur: number) => valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
const opus = computed(() => props.empreinte.hypotheses.modeles.opus)
</script>

<template>
  <section aria-labelledby="titre-empreinte">
    <h2 id="titre-empreinte" class="titre-4 mt-5w">Empreinte carbone d’ADA</h2>
    <p v-if="!empreinte.total.tokensSortie" class="texte-sm">
      Rien de mesuré pour l’instant : l’empreinte se calcule à chaque travail d’ADA à partir de maintenant.
    </p>
    <template v-else>
      <div class="empreinte__carte">
        <p class="empreinte__valeur">{{ formaterCo2(empreinte.total.co2g) }}</p>
        <p class="mb-1w">
          soit <strong>{{ parlants[0] }}</strong>, ou
          <strong>{{ parlants[1] }}</strong>
        </p>
        <p class="texte-sm mb-0">
          Électricité : {{ formaterEnergie(empreinte.total.energieWh) }}, soit {{ enAmpoule(empreinte.total.energieWh, empreinte.equivalents.ampouleLedW) }}<span v-if="depuis">, depuis le {{ depuis }}</span>.
          Estimation en fourchette : la taille des modèles n’est pas publiée.
        </p>
      </div>

      <UiTableau v-if="lignes.length > 1" class="tableau-pleine-largeur mt-3w" title="Empreinte par projet" no-caption :headers="entetes" :rows="lignes" />

      <UiAccordeons v-model="ouvert" class="mt-2w">
        <UiAccordeon id="methode-empreinte" title="Comment c’est calculé">
          <p class="texte-sm">
            ADA note, à chaque travail, le nombre de tokens produits par chaque modèle (jamais le contenu).
            L’empreinte en est déduite avec la méthode ouverte
            <a href="https://ecologits.ai/latest/methodology/llm_inference/" target="_blank" rel="noopener">EcoLogits<span class="visuellement-cache"> (nouvelle fenêtre)</span></a>,
            qui s’appuie sur la Base Empreinte de l’ADEME : énergie des serveurs et part de leur fabrication.
          </p>
          <ul class="texte-sm">
            <li>
              Taille supposée d’Opus : {{ opus?.totalMilliards }} milliards de paramètres, {{ opus?.actifsMilliards.min }} à
              {{ opus?.actifsMilliards.max }} milliards actifs ({{ opus?.source }}) : c’est l’essentiel de l’écart de la fourchette.
            </li>
            <li>Électricité aux États-Unis, où sont les serveurs : {{ empreinte.hypotheses.electriciteGCo2ParKwh }} g CO2e par kWh (Ember 2024, repris par Our World in Data).</li>
            <li>
              Équivalents de l’ADEME (<a href="https://impactco2.fr" target="_blank" rel="noopener">Impact CO2<span class="visuellement-cache"> (nouvelle fenêtre)</span></a>) :
              {{ empreinte.equivalents.rechercheWebG }} g par recherche web, {{ empreinte.equivalents.streamingHeureG }} g par heure de streaming vidéo,
              {{ Math.round(empreinte.equivalents.voitureKmG) }} g par km en voiture thermique,
              {{ nombreFr(empreinte.equivalents.tgvAllerRetourParisMarseilleG / 1000) }} kg pour un aller-retour Paris–Marseille en TGV,
              {{ Math.round(empreinte.equivalents.avionAllerRetourParisNewYorkG / 1000) }} kg pour un aller-retour Paris–New York en avion.
              ADA choisit les deux comparaisons les plus parlantes selon la taille du total.
            </li>
            <li>
              L’ampoule traduit l’électricité consommée, pas le CO2 : c’est une hypothèse d’ADA (ampoule LED de {{ empreinte.equivalents.ampouleLedW }} W), pas un chiffre de l’ADEME.
            </li>
          </ul>
          <p class="texte-sm mb-1w"><strong>Limites</strong></p>
          <ul class="texte-sm">
            <li>Anthropic ne publie ni la taille de ses modèles ni leur consommation : le chiffre sera affiné quand on le saura.</li>
            <li>Seuls les tokens produits comptent (comme EcoLogits) ; la relecture du projet par ADA n’est pas comptée : c’est plutôt une borne basse pour cet usage.</li>
            <li>Ni l’entraînement des modèles, ni votre ordinateur, ni l’aperçu ne sont comptés.</li>
            <li>À titre de comparaison, Google mesure 0,24 Wh pour une question courante à Gemini : les estimations publiques varient beaucoup.</li>
          </ul>
        </UiAccordeon>
      </UiAccordeons>
    </template>
  </section>
</template>

<style scoped>
.empreinte__carte {
  padding: 1.5rem;
  background: var(--app-fond-succes);
  border-bottom: 4px solid var(--app-succes);
}
.empreinte__valeur {
  margin: 0 0 0.25rem;
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}
</style>
