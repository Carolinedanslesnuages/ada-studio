import 'virtual:uno.css'
import './styles/icones.css'
import './styles.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Ui from '@/components/ui'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Ui)

app.mount('#app')
