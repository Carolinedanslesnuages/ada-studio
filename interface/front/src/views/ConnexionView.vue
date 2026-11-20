<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const message = computed(() =>
  route.query.erreur === 'non-autorise'
    ? 'Votre compte GitHub n’est pas autorisé à utiliser cet atelier. Demandez l’accès à son administrateur.'
    : route.query.erreur === 'github'
      ? 'GitHub a refusé la connexion de l’atelier (configuration de l’application GitHub). Prévenez son administrateur.'
      : route.query.erreur
        ? 'La connexion n’a pas abouti. Réessayez.'
      : null,
)

const etapes = [
  {
    titre: 'Créez votre projet',
    texte: 'Quelques questions suffisent : son nom, son objectif, le type de produit.',
  },
  {
    titre: 'Écrivez vos stories',
    texte: 'Un rôle, un besoin, un bénéfice, et quatre critères d’acceptation au maximum.',
  },
  {
    titre: 'Validez le plan',
    texte: 'ADA pose ses questions, puis vous propose un plan avant de commencer.',
  },
  {
    titre: 'Regardez le résultat',
    texte: 'L’aperçu de votre produit se met à jour à côté de vos stories.',
  },
  {
    titre: 'Publiez la version',
    texte: 'Quand tous les contrôles sont au vert, vous validez la version depuis ADA.',
  },
]

const garanties = [
  {
    icone: 'icone-checkbox-circle-line',
    titre: 'Des tests à chaque story',
    texte: 'Chaque fonctionnalité arrive avec ses tests, écrits avant le code.',
  },
  {
    icone: 'icone-eye-line',
    titre: 'L’accessibilité vérifiée',
    texte: 'Contrôle automatique et grille RGAA 4.1.2 complète, à chaque story.',
  },
  {
    icone: 'icone-lock-line',
    titre: 'Un travail cloisonné',
    texte: 'ADA ne travaille que dans votre projet : aucun secret, aucune donnée réelle.',
  },
  {
    icone: 'icone-git-pull-request-line',
    titre: 'Des versions maîtrisées',
    texte: 'Rien ne change sans votre accord ; chaque version a son récapitulatif.',
  },
]
</script>

<template>
  <div class="accueil">
    <section class="accueil__hero grille grille--gutters grille--middle">
      <div class="col-12 col-lg-6">
        <p class="badge badge--info mb-2w">Atelier de Développement Assisté</p>
        <h1 class="accueil__titre mb-2w">ADA <span class="badge-edition">studio</span></h1>
        <p class="texte-intro mb-2w">
          Un outil pour les non-développeurs : décrivez votre besoin, ADA réalise
          votre POC et vous le voyez se construire.
        </p>
        <UiAlerte v-if="message" type="error" small :description="message" class="mb-3w" />
        <a class="bouton bouton--lg" href="/api/auth/github"><span class="icone icone-github-fill" aria-hidden="true" />
          Se connecter avec GitHub
        </a>
        <p class="texte-sm mt-3w mb-0">
          Vos stories sont enregistrées comme des « issues » dans les dépôts GitHub de vos projets,
          en votre nom.
        </p>
      </div>
      <div class="col-12 col-lg-6">
        <div class="accueil__maquette" aria-hidden="true">
          <div class="accueil__maquette-barre">ADA · mon-projet</div>
          <div class="accueil__maquette-corps">
            <div class="accueil__maquette-stories">
              <div class="accueil__story">
                <span class="badge badge--success badge--sm">Livrée</span>
                <span>Voir les salles libres</span>
              </div>
              <div class="accueil__story">
                <span class="badge badge--info badge--sm">En cours</span>
                <span>Réserver une salle</span>
              </div>
              <div class="accueil__story">
                <span class="badge badge--new badge--sm">Plan à valider</span>
                <span>Annuler une réservation</span>
              </div>
            </div>
            <div class="accueil__maquette-apercu">
              <span class="accueil__bloc accueil__bloc--titre"></span>
              <span class="accueil__bloc accueil__bloc--grand"></span>
              <span class="accueil__bloc"></span>
              <span class="accueil__bloc accueil__bloc--court"></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="accueil__section" aria-labelledby="titre-etapes">
      <h2 id="titre-etapes">Comment ça marche</h2>
      <ol class="accueil__etapes">
        <li v-for="(etape, i) in etapes" :key="etape.titre" class="accueil__etape">
          <span class="accueil__numero" aria-hidden="true">{{ i + 1 }}</span>
          <h3 class="titre-6 mb-1w">{{ etape.titre }}</h3>
          <p class="texte-sm mb-0">{{ etape.texte }}</p>
        </li>
      </ol>
    </section>

    <section class="accueil__section accueil__section--alt" aria-labelledby="titre-garanties">
      <h2 id="titre-garanties">Ce qu’ADA garantit</h2>
      <p class="mb-4w">
        La qualité ne dépend pas de vos connaissances techniques : elle est inscrite dans l’atelier
        et contrôlée automatiquement.
      </p>
      <ul class="accueil__garanties grille grille--gutters">
        <li v-for="g in garanties" :key="g.titre" class="col-12 col-md-6 col-lg-3">
          <div class="accueil__garantie">
            <span :class="[g.icone, 'accueil__icone']" aria-hidden="true"></span>
            <h3 class="titre-6 mb-1w">{{ g.titre }}</h3>
            <p class="texte-sm mb-0">{{ g.texte }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section class="accueil__section accueil__fin" aria-labelledby="titre-commencer">
      <h2 id="titre-commencer">Prêt à commencer ?</h2>
      <p>Il vous suffit d’un compte GitHub autorisé par l’administrateur de l’atelier.</p>
      <a class="bouton bouton--secondaire" href="/api/auth/github"><span class="icone icone-github-fill" aria-hidden="true" />
        Se connecter avec GitHub
      </a>
    </section>
  </div>
</template>

<style scoped>
.accueil__titre {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 3.5rem;
  letter-spacing: 0.08em;
}

.accueil {
  max-width: 78rem;
  margin: 0 auto;
}

.accueil__hero {
  padding: 2rem 0 3rem;
}

.accueil__section {
  padding: 3rem 0;
  border-top: 1px solid var(--app-bordure);
}

.accueil__section--alt {
  background-color: var(--app-fond-primaire);
  border-top: none;
  padding: 3rem 2rem;
}

/* Maquette décorative de l'atelier */
.accueil__maquette {
  border: 1px solid var(--app-bordure);
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: var(--app-fond);
  box-shadow: 0 6px 18px rgb(0 0 18 / 16%);
}

.accueil__maquette-barre {
  background-color: var(--app-primaire);
  color: var(--app-texte-inverse);
  font-weight: 700;
  padding: 0.75rem 1rem;
}

.accueil__maquette-corps {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  min-height: 16rem;
}

.accueil__maquette-stories {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border-right: 1px solid var(--app-bordure);
}

.accueil__story {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background-color: var(--app-fond-doux);
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.accueil__maquette-apercu {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--app-fond-primaire);
}

.accueil__bloc {
  display: block;
  height: 1.5rem;
  border-radius: 0.25rem;
  background-color: var(--app-fond-primaire);
}

.accueil__bloc--titre {
  width: 60%;
  background-color: var(--app-fond-primaire);
}

.accueil__bloc--grand {
  height: 6rem;
}

.accueil__bloc--court {
  width: 45%;
}

/* Étapes */
.accueil__etapes {
  list-style: none;
  padding: 0;
  margin: 2rem 0 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1.5rem;
}

.accueil__etape {
  list-style: none;
  margin: 0;
  padding: 1rem 0 0;
  border-top: 4px solid var(--app-primaire);
}

.accueil__etape::marker {
  content: none;
}

.accueil__numero {
  display: block;
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
  color: var(--app-primaire);
  margin-bottom: 0.75rem;
}

/* Garanties */
.accueil__garanties {
  list-style: none;
  padding: 0;
  margin: 0;
}

.accueil__garanties li {
  padding-bottom: 0;
}

.accueil__garantie {
  height: 100%;
  padding: 1.5rem;
  background-color: var(--app-fond);
  border-bottom: 4px solid var(--app-primaire);
}

.accueil__icone {
  display: block;
  color: var(--app-primaire);
  margin-bottom: 0.75rem;
}

.accueil__icone::before {
  --icon-size: 2rem;
}

.accueil__fin {
  text-align: center;
}

@media (max-width: 62em) {
  .accueil__etapes {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 36em) {
  .accueil__etapes {
    grid-template-columns: 1fr;
  }

  .accueil__maquette-corps {
    grid-template-columns: 1fr;
  }

  .accueil__maquette-stories {
    border-right: none;
  }
}
</style>
