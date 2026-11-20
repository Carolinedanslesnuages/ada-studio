<script setup lang="ts">
import { computed, useId } from 'vue'
import { Label } from 'reka-ui'

/** Champ de saisie (étiquette Reka UI) : étiquette visible liée, aide et erreur reliées (aria-describedby), obligatoire signalé. */
const props = withDefaults(
  defineProps<{
    label: string
    aide?: string
    erreur?: string
    requis?: boolean
    disabled?: boolean
    type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'password'
  }>(),
  { aide: undefined, erreur: undefined, type: 'text' },
)
const valeur = defineModel<string>({ default: '' })
const id = useId()
const decrit = computed(
  () => [props.aide ? `${id}-aide` : '', props.erreur ? `${id}-erreur` : ''].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div :class="['champ', { 'champ--erreur': erreur }]">
    <Label :for="id" class="champ__etiquette">
      {{ label }}<span v-if="requis"> (obligatoire)</span>
    </Label>
    <p v-if="aide" :id="`${id}-aide`" class="champ__aide">{{ aide }}</p>
    <input
      :id="id"
      v-model="valeur"
      :type="type"
      class="champ__saisie"
      :required="requis"
      :disabled="disabled"
      :aria-invalid="erreur ? 'true' : undefined"
      :aria-describedby="decrit"
    />
    <p v-if="erreur" :id="`${id}-erreur`" class="champ__erreur">{{ erreur }}</p>
  </div>
</template>

<style scoped>
.champ {
  margin-bottom: 1.5rem;
}

.champ__etiquette {
  display: block;
  font-weight: 600;
}

.champ__aide {
  margin: 0.25rem 0 0;
  color: var(--app-texte-doux);
  font-size: 0.875rem;
}

.champ__saisie {
  display: block;
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--app-bordure-champ);
  border-radius: var(--app-rayon);
  font: inherit;
  color: var(--app-texte);
  background: var(--app-fond);
}

.champ__saisie:disabled {
  background: var(--app-fond-doux);
  cursor: not-allowed;
}

.champ--erreur .champ__saisie {
  border: 2px solid var(--app-erreur);
  background: var(--app-fond-erreur);
}

.champ__erreur {
  margin: 0.5rem 0 0;
  color: var(--app-erreur);
  font-weight: 600;
}
</style>
