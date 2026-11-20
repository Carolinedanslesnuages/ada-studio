<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <a class="lien-evitement" href="#contenu">Aller au contenu</a>
  <header class="entete">
    <div class="conteneur">
      <RouterLink to="/" class="entete__nom">__NOM_PROJET__</RouterLink>
      <p class="entete__baseline">__BASELINE__</p>
    </div>
  </header>
  <p class="bandeau"><span class="conteneur">Maquette — données fictives : rien de ce que vous voyez n’est réel ni enregistré.</span></p>
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

.bandeau {
  margin: 0;
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
