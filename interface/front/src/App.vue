<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const router = useRouter()

async function deconnecter(): Promise<void> {
  await session.deconnecter()
  await router.push({ name: 'connexion' })
}
</script>

<template>
  <a class="lien-evitement" href="#contenu">Aller au contenu</a>
  <header class="entete">
    <div class="entete__interieur">
      <!-- Le badge « studio » dit toujours laquelle des deux ADA est ouverte. -->
      <RouterLink to="/" class="entete__marque">
        <span class="entete__sigle">ADA</span>
        <span class="badge-edition">studio</span>
        <span class="entete__nom">Atelier de Développement Assisté</span>
      </RouterLink>
      <nav v-if="session.utilisateur" class="entete__liens" aria-label="Liens rapides">
        <RouterLink to="/indicateurs" class="lien-rapide">
          <span class="icone icone-line-chart-line" aria-hidden="true" />Indicateurs
        </RouterLink>
        <RouterLink to="/" class="lien-rapide">
          <span class="icone icone-user-line" aria-hidden="true" />{{ session.utilisateur.nom ?? session.utilisateur.login }}
        </RouterLink>
        <button type="button" class="lien-rapide" @click="deconnecter">
          <span class="icone icone-logout-box-r-line" aria-hidden="true" />Se déconnecter
        </button>
      </nav>
    </div>
  </header>
  <main id="contenu" class="conteneur--fluide px-4w my-4w" tabindex="-1">
    <RouterView />
  </main>
  <footer class="pied">
    <div class="pied__interieur">
      <p class="texte-sm">ADA studio — Atelier de Développement Assisté. Des POC accessibles et testés, réalisés avec un assistant de code.</p>
    </div>
  </footer>
</template>
