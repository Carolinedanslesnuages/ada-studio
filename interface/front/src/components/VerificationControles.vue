<script setup lang="ts">
/** Vérification d'une demande réalisée : contrôles de la PR, puis « Valider et fusionner ». */
import { LIBELLES_CONTROLE, type Verification } from '@/lib/story'

defineProps<{ verification: Verification | null | undefined; actionEnCours?: boolean }>()
const emit = defineEmits<{ fusionner: []; relancerControles: [] }>()
</script>

<template>
  <p class="texte-sm">
    Regardez le résultat dans l’aperçu. Quand tous les contrôles sont réussis, validez :
    la demande sera ajoutée au projet et la suivante pourra être lancée.
  </p>
  <p v-if="!verification" class="texte-sm">Lecture des contrôles…</p>
  <template v-else>
    <ul class="texte-sm controles">
      <li v-for="controle in verification.controles" :key="controle.nom">
        <span
          :class="{ 'icone icone-checkbox-circle-fill controle--ok': controle.etat === 'reussi', 'icone icone-close-circle-fill controle--ko': controle.etat === 'echec', 'icone icone-time-line': controle.etat === 'en-cours' || controle.etat === 'en-attente', 'icone icone-alert-line': controle.etat === 'non-lance', }"
          class="icone icone--sm"
          aria-hidden="true"
        />
        {{ controle.nom }} : {{ LIBELLES_CONTROLE[controle.etat] }}
      </li>
    </ul>
    <p v-if="verification.raison" class="texte-sm mb-2w">{{ verification.raison }}</p>
    <ul class="groupe-boutons">
      <li>
        <UiBouton
          icon="icone-check-line"
          label="Valider et fusionner"
          :disabled="!verification.fusionnable || actionEnCours"
          @click="emit('fusionner')"
        />
      </li>
      <li v-if="verification.controles.some((controle) => controle.etat === 'non-lance')">
        <UiBouton secondary icon="icone-refresh-line" label="Relancer les contrôles" :disabled="actionEnCours" @click="emit('relancerControles')" />
      </li>
    </ul>
  </template>
</template>
