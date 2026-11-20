<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <a class="lien-evitement" href="#contenu">Aller au contenu</a>
  <header class="entete">
    <div class="conteneur entete__interieur">
      <div>
        <RouterLink to="/" class="entete__nom">__NOM_PROJET__</RouterLink>
        <p class="entete__baseline">__BASELINE__</p>
      </div>
      <nav aria-label="Pages du formulaire">
        <ul class="entete__liens">
          <li><RouterLink to="/">Formulaire</RouterLink></li>
          <li><RouterLink to="/reponses">Réponses</RouterLink></li>
        </ul>
      </nav>
    </div>
  </header>
  <main id="contenu" class="conteneur contenu" tabindex="-1">
    <RouterView />
  </main>
  <footer class="pied">
    <div class="conteneur">
      <p>__NOM_PROJET__</p>
    </div>
  </footer>
</template>

<style scoped>
.entete {
  padding: 1rem 0;
  border-bottom: 1px solid var(--app-bordure);
}

.entete__interieur {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.entete__nom {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--app-texte);
  text-decoration: none;
}

.entete__baseline {
  margin: 0.25rem 0 0;
  color: var(--app-texte-doux);
}

.entete__baseline:empty {
  display: none;
}

.entete__liens {
  display: flex;
  gap: 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entete__liens a[aria-current='page'] {
  font-weight: 700;
}

.contenu {
  padding-top: 2rem;
  padding-bottom: 3rem;
}

.pied {
  padding: 1.5rem 0;
  border-top: 1px solid var(--app-bordure);
  background: var(--app-fond-doux);
}
</style>
