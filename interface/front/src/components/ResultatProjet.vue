<script setup lang="ts">
import type { ResultatCreation } from '@/lib/projet'

defineProps<{ resultat: ResultatCreation }>()
const emit = defineEmits<{ fermer: []; suivre: [numero: number] }>()
</script>

<template>
  <section aria-labelledby="titre-resultat">
    <h2 id="titre-resultat" class="titre-4">Projet « {{ resultat.projet.nom }} » créé</h2>
    <UiAlerte
      type="success"
      small
      description="Le dépôt est prêt sur GitHub, avec ses tests, ses contrôles et sa première version."
    />
    <p v-if="resultat.idee" class="mt-2w">
      <strong>Votre idée est enregistrée (demande n° {{ resultat.idee }}).</strong> ADA l’étudie :
      il va vous poser ses questions, puis vous proposer l’objectif et les premières stories à valider.
    </p>
    <p v-else class="mt-2w">Vous pouvez écrire votre première story, ou « Prompter » une demande libre.</p>

    <div class="mt-3w" role="status">
      <h3 class="titre-6">Réglages GitHub</h3>
      <ul>
        <li>
          Versions automatiques :
          <strong>{{ resultat.reglages.versionsAutomatiques.etat === 'fait' ? 'activées' : 'à activer' }}</strong>
        </li>
        <li>
          Protection de la branche principale :
          <strong>{{ resultat.reglages.protectionMain.etat === 'fait' ? 'activée' : 'à activer' }}</strong>
        </li>
      </ul>
    </div>

    <div v-if="resultat.reglages.versionsAutomatiques.etat === 'a-faire'" class="encart mt-2w">
      <h3 class="encart__titre titre-6">Autoriser les versions automatiques (une fois)</h3>
      <ol class="encart__texte texte-sm">
        <li>
          Ouvrez
          <a :href="resultat.reglages.versionsAutomatiques.lien" target="_blank" rel="noopener">
            les réglages Actions du dépôt<span class="visuellement-cache"> (nouvelle fenêtre)</span>
          </a>.
        </li>
        <li>
          Tout en bas, <strong>Workflow permissions</strong> : cochez <strong>Read and write
          permissions</strong> et <strong>Allow GitHub Actions to create and approve pull
          requests</strong>, puis <strong>Save</strong>.
        </li>
        <li>Cases grisées : un administrateur de l’organisation doit l’autoriser.</li>
      </ol>
    </div>

    <div v-if="resultat.reglages.protectionMain.etat === 'a-faire'" class="encart mt-2w">
      <h3 class="encart__titre titre-6">Protéger la branche principale</h3>
      <p class="encart__texte texte-sm">
        GitHub n’a pas accepté la protection automatique. Sur un compte personnel gratuit, elle
        n’existe pas pour les dépôts privés : l’atelier n’autorisera de toute façon la
        fusion que lorsque tous les contrôles sont verts. Sinon, créez une règle depuis
        <a :href="resultat.reglages.protectionMain.lien" target="_blank" rel="noopener">
          les règles du dépôt<span class="visuellement-cache"> (nouvelle fenêtre)</span>
        </a>
        (voir le guide PO).
      </p>
    </div>

    <UiBouton
      v-if="resultat.idee"
      class="mt-3w"
      label="Suivre ADA sur mon idée"
      @click="emit('suivre', resultat.idee)"
    />
    <UiBouton v-else class="mt-3w" label="Écrire la première story" @click="emit('fermer')" />
  </section>
</template>
