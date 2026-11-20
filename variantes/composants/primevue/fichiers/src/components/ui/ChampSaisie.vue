<script setup lang="ts">
import { computed, useId } from 'vue'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'

/** Champ de saisie (PrimeVue) : étiquette visible liée, aide et erreur reliées, obligatoire signalé. */
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
  <div class="champ">
    <label :for="id" class="champ__etiquette">{{ label }}<span v-if="requis"> (obligatoire)</span></label>
    <small v-if="aide" :id="`${id}-aide`" class="champ__aide">{{ aide }}</small>
    <InputText
      :id="id"
      v-model="valeur"
      :type="type"
      :required="requis"
      :disabled="disabled"
      :invalid="Boolean(erreur)"
      :aria-invalid="erreur ? 'true' : undefined"
      :aria-describedby="decrit"
      fluid
    />
    <Message v-if="erreur" :id="`${id}-erreur`" severity="error" size="small" variant="simple">{{ erreur }}</Message>
  </div>
</template>

<style scoped>
.champ {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.champ__etiquette {
  font-weight: 600;
}

.champ__aide {
  color: var(--app-texte-doux);
}
</style>
