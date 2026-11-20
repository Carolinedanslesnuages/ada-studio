import { createRouter, createWebHistory } from 'vue-router'
import QuizView from '../views/QuizView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: '/', name: 'quiz', component: QuizView }],
})

// Titre de page qui dit où l'on est (RGAA 8.6).
router.afterEach(() => {
  document.title = '__NOM_PROJET__'
})

export default router
