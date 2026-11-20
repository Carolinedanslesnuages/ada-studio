<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import BoutonAction from '@/components/ui/BoutonAction.vue'

/** Une nouvelle version est prête : on le propose, sans recharger d'office (une saisie peut être en cours). */
const { needRefresh, updateServiceWorker } = useRegisterSW()
</script>

<template>
  <div role="status" class="conteneur">
    <div v-if="needRefresh" class="alerte mise-a-jour">
      <h2 class="alerte__titre">Une nouvelle version est disponible</h2>
      <p>Vos relevés sont conservés.</p>
      <div class="mise-a-jour__actions">
        <BoutonAction label="Mettre à jour" @click="updateServiceWorker(true)" />
        <BoutonAction label="Plus tard" variante="secondaire" @click="needRefresh = false" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mise-a-jour {
  margin-top: 1rem;
}

.mise-a-jour__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
