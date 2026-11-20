<script setup lang="ts">
import { ref } from 'vue'
import ListeStories from '@/components/ListeStories.vue'
import StoriesLivrees from '@/components/StoriesLivrees.vue'
import PanneauVersions from '@/components/PanneauVersions.vue'
import { lienNouvelleIssue } from '@/lib/story'
import { useProjetsStore } from '@/stores/projets'
import { useStoriesStore } from '@/stores/stories'

/**
 * Barre latérale, façon Claude : une nouvelle conversation, les projets, puis les demandes du
 * projet ouvert. Le secondaire (GitHub, création, reprise) est rangé en bas.
 */
const emit = defineEmits<{
  accueil: []
  choisir: [id: string]
  ouvrir: [numero: number]
  actualiser: []
  nouveauProjet: []
  reprendreProjet: []
  masquerProjet: []
}>()

const projets = useProjetsStore()
const stories = useStoriesStore()
const versionsOuvertes = ref(-1)
</script>

<template>
  <nav class="barre" aria-label="Projets et demandes">
    <UiBouton
      class="barre__nouveau"
      icon="icone-add-line"
      label="Nouvelle conversation"
      :disabled="!projets.idCourant"
      @click="emit('accueil')"
    />

    <h2 class="barre__titre">Projets</h2>
    <p v-if="projets.chargement" class="texte-sm">Chargement…</p>
    <ul v-else class="barre__liste" aria-label="Vos projets">
      <li v-for="projet in projets.liste" :key="projet.id">
        <button type="button" :aria-current="projet.id === projets.idCourant ? 'true' : undefined" @click="emit('choisir', projet.id)">
          <span class="icone icone-folder-2-line icone--sm" aria-hidden="true" />
          <span class="barre__nom">{{ projet.nom }}</span>
          <span v-if="projet.reprise" class="badge badge--sm badge--warning">reprise</span>
        </button>
      </li>
    </ul>

    <template v-if="projets.courant">
      <div class="barre__entete">
        <h2 id="titre-stories" class="barre__titre" tabindex="-1">Demandes</h2>
        <UiBouton tertiary no-outline size="sm" icon="icone-refresh-line" label="Actualiser" @click="emit('actualiser')" />
      </div>
      <p v-if="stories.chargement" class="texte-sm">Chargement…</p>
      <UiAlerte v-else-if="stories.erreur" type="error" small :description="stories.erreur" />
      <template v-else>
        <p v-if="stories.aFaire.length === 0" class="texte-sm">Aucune demande pour l’instant.</p>
        <ListeStories v-else :stories="stories.aFaire" :numero-courant="stories.courante?.numero ?? null" @ouvrir="(numero) => emit('ouvrir', numero)" />
        <StoriesLivrees
          v-if="stories.livrees.length > 0"
          :stories="stories.livrees"
          :url-depot="projets.courant.url"
          :numero-courant="stories.courante?.numero ?? null"
          @ouvrir="(numero) => emit('ouvrir', numero)"
        />
      </template>

      <UiAccordeons v-if="!projets.courant.reprise" v-model="versionsOuvertes" class="mt-2w">
        <UiAccordeon id="versions-projet" title="Versions du projet">
          <PanneauVersions :projet="projets.courant.id" />
        </UiAccordeon>
      </UiAccordeons>
    </template>

    <ul class="barre__pied" aria-label="Autres actions">
      <template v-if="projets.courant">
        <li>
          <a class="lien lien--sm" :href="lienNouvelleIssue(projets.courant.url, 'user-story.yml')" target="_blank" rel="noopener"><span class="icone icone-edit-line" aria-hidden="true" />
            Écrire une story sur GitHub<span class="visuellement-cache"> (nouvelle fenêtre)</span>
          </a>
        </li>
        <li>
          <a class="lien lien--sm" :href="lienNouvelleIssue(projets.courant.url, 'bug.yml')" target="_blank" rel="noopener"><span class="icone icone-error-warning-line" aria-hidden="true" />
            Signaler un problème sur GitHub<span class="visuellement-cache"> (nouvelle fenêtre)</span>
          </a>
        </li>
      </template>
      <li><button type="button" class="lien lien--sm" @click="emit('nouveauProjet')"><span class="icone icone-add-line" aria-hidden="true" />Nouveau projet</button></li>
      <li><button type="button" class="lien lien--sm" @click="emit('reprendreProjet')"><span class="icone icone-download-line" aria-hidden="true" />Reprendre un projet</button></li>
      <li v-if="projets.courant">
        <button type="button" class="lien lien--sm" @click="emit('masquerProjet')"><span class="icone icone-eye-off-line" aria-hidden="true" />Masquer le projet</button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.barre {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.barre__nouveau {
  width: 100%;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.barre__titre {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-texte-doux);
  margin: 0.75rem 0 0.25rem;
}

.barre__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.barre__liste {
  list-style: none;
  margin: 0;
  padding: 0;
}

.barre__liste li {
  padding: 0;
}

.barre__liste button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  background: none;
  text-align: left;
  cursor: pointer;
}

.barre__liste button:hover {
  background: var(--app-fond-survol);
}

.barre__liste button[aria-current='true'] {
  background: var(--app-fond-primaire);
  font-weight: 700;
}

.barre__nom {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.barre__pied {
  list-style: none;
  margin: auto 0 0;
  padding: 1rem 0 0;
  border-top: 1px solid var(--app-bordure);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.barre__pied li {
  padding: 0;
}
</style>
