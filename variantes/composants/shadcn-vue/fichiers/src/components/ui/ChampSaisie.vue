<script setup lang="ts">
import { computed, useId } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Champ de saisie (shadcn-vue) : étiquette visible liée, aide et erreur reliées, obligatoire signalé. */
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
  <div class="mb-6 grid gap-2">
    <Label :for="id">{{ label }}<span v-if="requis"> (obligatoire)</span></Label>
    <p v-if="aide" :id="`${id}-aide`" class="text-sm text-muted-foreground">{{ aide }}</p>
    <Input
      :id="id"
      v-model="valeur"
      :type="type"
      :required="requis"
      :disabled="disabled"
      :aria-invalid="erreur ? 'true' : undefined"
      :aria-describedby="decrit"
    />
    <p v-if="erreur" :id="`${id}-erreur`" class="text-sm font-semibold text-destructive">{{ erreur }}</p>
  </div>
</template>
