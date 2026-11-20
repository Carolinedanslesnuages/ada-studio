<script setup lang="ts">
import { computed, useId } from 'vue'
import { NInput } from 'naive-ui'

/** Champ de saisie (Naive UI) : étiquette visible liée, aide et erreur reliées, obligatoire signalé. */
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
const proprietesSaisie = computed(() => ({
  id,
  type: props.type,
  required: props.requis,
  'aria-invalid': props.erreur ? true : undefined,
  'aria-describedby': [props.aide ? `${id}-aide` : '', props.erreur ? `${id}-erreur` : ''].filter(Boolean).join(' ') || undefined,
}))
</script>

<template>
  <div class="champ">
    <label :for="id" class="champ__etiquette">{{ label }}<span v-if="requis"> (obligatoire)</span></label>
    <p v-if="aide" :id="`${id}-aide`" class="champ__aide">{{ aide }}</p>
    <NInput
      v-model:value="valeur"
      :input-props="proprietesSaisie"
      :disabled="disabled"
      :status="erreur ? 'error' : undefined"
      placeholder=""
    />
    <p v-if="erreur" :id="`${id}-erreur`" class="champ__erreur">{{ erreur }}</p>
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
  margin: 0;
  color: var(--app-texte-doux);
}

.champ__erreur {
  margin: 0;
  color: var(--app-erreur);
  font-weight: 600;
}
</style>
