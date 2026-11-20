import './interface/style'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { envelopper, installerComposants } from './interface/composants'

import App from './App.vue'
import router from './router'

const app = createApp(envelopper(App))

app.use(createPinia())
app.use(router)
installerComposants(app)

app.mount('#app')
