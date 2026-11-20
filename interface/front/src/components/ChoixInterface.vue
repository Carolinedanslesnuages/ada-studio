<script setup lang="ts">
import { computed, watch } from 'vue'
import { raisonRefus, type Combinaisons, type Modele } from '@/lib/projet'

/**
 * Création d'un projet avec front : le style et la bibliothèque de composants. Les combinaisons
 * impossibles sont désactivées, avec leur raison en une phrase. Toutes les options sont gratuites,
 * sous licence MIT et compatibles Vue 3.
 */
const props = defineProps<{ modele: Modele | null; combinaisons: Combinaisons | null; erreur?: string }>()
const style = defineModel<string>('style', { required: true })
const composants = defineModel<string>('composants', { required: true })

const choixLibre = computed(() => Boolean(props.combinaisons && props.modele?.interface?.variantes))
const refus = (valeur: string) => (props.combinaisons ? raisonRefus(props.combinaisons, style.value, valeur) : null)

// Un modèle sans variantes, ou une bibliothèque devenue incompatible : retour aux valeurs par défaut.
watch(
  [() => props.modele, style],
  () => {
    if (!props.combinaisons) return
    if (!choixLibre.value) {
      style.value = props.combinaisons.parDefaut.style
      composants.value = props.combinaisons.parDefaut.composants
    } else if (refus(composants.value)) {
      composants.value = props.combinaisons.parDefaut.composants
    }
  },
  { immediate: true },
)
</script>

<template>
  <template v-if="combinaisons && modele?.interface">
    <p v-if="!choixLibre" class="champ__aide mb-3w">
      Interface : ce modèle existe en CSS maison, sans bibliothèque de composants.
    </p>
    <template v-else>
      <fieldset class="groupe-choix" aria-describedby="style-aide">
        <legend class="groupe-choix__legende">Style de l’interface</legend>
        <p id="style-aide" class="champ__aide groupe-choix__element">Comment les écrans sont mis en forme.</p>
        <div v-for="option in combinaisons.styles" :key="option.valeur" class="groupe-choix__element">
          <div class="choix">
            <input :id="`style-${option.valeur}`" v-model="style" type="radio" name="style" :value="option.valeur" />
            <label class="champ__etiquette" :for="`style-${option.valeur}`">
              {{ option.nom }}
              <span class="champ__aide">{{ option.pourQui }}</span>
            </label>
          </div>
          <a class="lien lien--sm ml-4w" :href="option.doc" target="_blank" rel="noopener">
            {{ option.libelleDoc ?? `Documentation de ${option.nom}` }}<span class="visuellement-cache"> (nouvelle fenêtre)</span>
          </a>
        </div>
      </fieldset>

      <fieldset class="groupe-choix" :class="{ 'groupe-choix--erreur': erreur }" aria-describedby="composants-aide">
        <legend class="groupe-choix__legende">Bibliothèque de composants</legend>
        <p id="composants-aide" class="champ__aide groupe-choix__element">
          Les boutons, champs, fenêtres et tableaux prêts à l’emploi. Chaque projet est livré avec Storybook pour les voir.
        </p>
        <div v-for="option in combinaisons.composants" :key="option.valeur" class="groupe-choix__element">
          <div class="choix">
            <input
              :id="`composants-${option.valeur}`"
              v-model="composants"
              type="radio"
              name="composants"
              :value="option.valeur"
              :disabled="Boolean(refus(option.valeur))"
              :aria-describedby="refus(option.valeur) ? `composants-${option.valeur}-refus` : undefined"
            />
            <label class="champ__etiquette" :for="`composants-${option.valeur}`">
              {{ option.nom }}
              <span class="champ__aide">{{ option.pourQui }}</span>
              <span v-if="refus(option.valeur)" :id="`composants-${option.valeur}-refus`" class="champ__aide">
                Indisponible : {{ refus(option.valeur) }}
              </span>
            </label>
          </div>
          <a class="lien lien--sm ml-4w" :href="option.doc" target="_blank" rel="noopener">
            {{ option.libelleDoc ?? `Documentation de ${option.nom}` }}<span class="visuellement-cache"> (nouvelle fenêtre)</span>
          </a>
        </div>
        <p v-if="erreur" class="champ__erreur groupe-choix__element" role="alert">{{ erreur }}</p>
      </fieldset>
    </template>
  </template>
</template>
