import { createRouter, createWebHistory } from 'vue-router'
import FormulaireView from '../views/FormulaireView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'formulaire', component: FormulaireView, meta: { titre: 'Formulaire' } },
    { path: '/reponses', name: 'reponses', component: () => import('../views/ReponsesView.vue'), meta: { titre: 'Réponses' } },
  ],
})

// Titre de page qui dit où l'on est (RGAA 8.6).
router.afterEach((destination) => {
  document.title = `${String(destination.meta.titre ?? '')} — __NOM_PROJET__`
})

export default router
