<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useReglagesStore } from '@/stores/reglages'

const magasin = useReglagesStore()
const { reglages, charge } = storeToRefs(magasin)
const message = ref('')
const erreur = ref('')

onMounted(() => magasin.charger())

async function basculer(evenement: Event): Promise<void> {
  const active = (evenement.target as HTMLInputElement).checked
  erreur.value = ''
  try {
    await magasin.changerActivation(active)
    message.value = active ? 'Extension activée.' : 'Extension désactivée.'
  } catch {
    erreur.value = 'Le réglage n’a pas pu être enregistré. Réessayez.'
  }
}
</script>

<template>
  <main>
    <h1>__NOM_PROJET__</h1>
    <p class="aide">__BASELINE__</p>
    <p v-if="!charge" role="status">Chargement…</p>
    <template v-else>
      <div class="choix">
        <input id="activation" type="checkbox" :checked="reglages.active" @change="basculer" />
        <label for="activation">
          Activer l’extension
          <span class="aide"> — désactivée, elle n’agit sur aucune page.</span>
        </label>
      </div>
    </template>
    <p role="status" class="message-succes">{{ message }}</p>
    <p v-if="erreur" role="alert" class="message-erreur">{{ erreur }}</p>
  </main>
</template>
