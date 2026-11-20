<script setup lang="ts">
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Fenêtre de dialogue modale (shadcn-vue) : focus piégé, Échap la ferme, focus rendu ensuite. */
defineProps<{ titre: string }>()
const ouvert = defineModel<boolean>('ouvert', { default: false })
</script>

<template>
  <Dialog v-model:open="ouvert">
    <DialogContent :aria-describedby="undefined">
      <DialogHeader>
        <DialogTitle>{{ titre }}</DialogTitle>
      </DialogHeader>
      <slot />
      <DialogFooter>
        <slot name="actions" />
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
