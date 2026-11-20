import './styles/jetons.css'
import './style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
