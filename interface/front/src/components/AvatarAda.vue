<script setup lang="ts">
import { ref } from 'vue'

/**
 * Petit avatar d'ADA, en bas à droite, qui fait coucou tant qu'elle travaille : une fille aux
 * cheveux aux couleurs d'ADA studio (carré, raie au milieu, chignon en clin d'œil à Ada Lovelace), visage
 * clair, yeux qui clignent parfois. Un clic l'immobilise (RGAA 13.8 : une animation doit pouvoir
 * être arrêtée) ; un autre la relance ; le choix est gardé sur l'appareil. Sans animation non
 * plus si la personne a demandé à réduire les mouvements.
 */
defineProps<{ phase?: string | null }>()

const CLE = 'ada-studio:avatar-immobile'
function lireChoix(): boolean {
  try {
    return localStorage.getItem(CLE) === 'oui'
  } catch {
    return false
  }
}
const immobile = ref(lireChoix())
function basculer(): void {
  immobile.value = !immobile.value
  try {
    if (immobile.value) localStorage.setItem(CLE, 'oui')
    else localStorage.removeItem(CLE)
  } catch {
    // stockage indisponible : le choix vaut pour cette visite
  }
}
</script>

<template>
  <button
    type="button"
    class="avatar-ada"
    :class="{ 'avatar-ada--immobile': immobile }"
    :title="immobile ? 'Relancer l’animation' : 'Arrêter l’animation'"
    data-testid="avatar-ada"
    @click="basculer"
  >
    <svg class="avatar-ada__dessin" aria-hidden="true" viewBox="0 0 68 64" width="54" height="51" focusable="false">
      <circle class="avatar-ada__cheveux" cx="29" cy="10" r="6" />
      <path class="avatar-ada__cheveux" d="M8 34 A21 21 0 0 1 50 34 L50 45 Q50 51 45 50.5 Q42.5 50 42.5 46 L42.5 40 L15.5 40 L15.5 46 Q15.5 50 13 50.5 Q8 51 8 45 Z" />
      <circle class="avatar-ada__visage" cx="29" cy="39" r="14.5" />
      <path
        class="avatar-ada__cheveux"
        d="M13.5 37 Q14 22 29 21 Q44 22 44.5 37 Q41 29 30.5 27.5 Q29 26 27.5 27.5 Q17 29 13.5 37 Z"
      />
      <g class="avatar-ada__yeux">
        <ellipse cx="23" cy="39" rx="2.2" ry="2.9" />
        <ellipse cx="35" cy="39" rx="2.2" ry="2.9" />
      </g>
      <path class="avatar-ada__sourire" d="M24.5 45 Q29 48.5 33.5 45" />
      <g class="avatar-ada__main" fill="currentColor" stroke="currentColor" stroke-linecap="round">
        <rect x="52" y="27" width="11" height="12" rx="4.5" stroke="none" />
        <line x1="54" y1="28" x2="54" y2="21" stroke-width="3" />
        <line x1="57.5" y1="28" x2="57.5" y2="19" stroke-width="3" />
        <line x1="61" y1="28" x2="61" y2="21" stroke-width="3" />
        <line x1="53" y1="35" x2="49.5" y2="31" stroke-width="3" />
        <line x1="57" y1="39" x2="56" y2="46" stroke-width="5" />
      </g>
      <path class="avatar-ada__etoile" d="M47 4 Q47.8 8.2 52 9 Q47.8 9.8 47 14 Q46.2 9.8 42 9 Q46.2 8.2 47 4 Z" />
    </svg>
    <span class="avatar-ada__texte">
      ADA {{ phase === 'realisation' ? 'réalise' : phase === 'conversation' ? 'répond' : 'analyse' }}…
    </span>
    <span class="visuellement-cache">{{ immobile ? ' : relancer l’animation' : ' : arrêter l’animation' }}</span>
  </button>
</template>

<style scoped>
.avatar-ada {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 750;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem 0.25rem 0.25rem;
  color: var(--app-primaire);
  background: var(--app-fond);
  border: 1px solid var(--app-bordure);
  border-radius: 2rem;
  box-shadow: 0 2px 6px rgb(0 0 18 / 16%);
  font: inherit;
  cursor: pointer;
}

.avatar-ada:hover {
  background: var(--app-fond-survol);
}

.avatar-ada:focus-visible {
  outline: 2px solid #7c3aed;
  outline-offset: 2px;
}

.avatar-ada--immobile .avatar-ada__main,
.avatar-ada--immobile .avatar-ada__yeux {
  animation: none;
}

.avatar-ada__dessin {
  flex-shrink: 0;
}

.avatar-ada__etoile {
  fill: var(--app-erreur);
}

.avatar-ada__texte {
  font-size: 0.875rem;
  font-weight: 700;
}

.avatar-ada__cheveux,
.avatar-ada__yeux {
  fill: currentColor;
}

.avatar-ada__visage {
  fill: var(--app-fond);
  stroke: currentColor;
  stroke-width: 2.2;
}

.avatar-ada__sourire {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.8;
  stroke-linecap: round;
}

.avatar-ada__yeux {
  transform-box: fill-box;
  transform-origin: center;
  animation: cligne 4.8s ease-in-out infinite;
}

.avatar-ada__main {
  transform-box: view-box;
  transform-origin: 56px 46px;
  animation: coucou 2.4s ease-in-out infinite;
}

/* Un clignement bref, de temps en temps. */
@keyframes cligne {
  0%,
  92%,
  100% {
    transform: scaleY(1);
  }
  95% {
    transform: scaleY(0.1);
  }
}

/* Trois petits signes de la main, puis une pause : présent sans être agité. */
@keyframes coucou {
  0%,
  45%,
  100% {
    transform: rotate(8deg);
  }
  8%,
  24% {
    transform: rotate(22deg);
  }
  16%,
  32% {
    transform: rotate(-4deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .avatar-ada__main,
  .avatar-ada__yeux {
    animation: none;
  }
}

@media (max-width: 36em) {
  .avatar-ada {
    right: 1rem;
    bottom: 1rem;
  }
  .avatar-ada__texte {
    display: none;
  }
  .avatar-ada {
    padding: 0.25rem;
  }
}
</style>
