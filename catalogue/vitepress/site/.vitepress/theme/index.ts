import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './styles/jetons.css'
import './style.css'

/** Thème par défaut de VitePress, aux couleurs du projet (jetons --app-*, src/styles/jetons.css). */
const theme: Theme = {
  extends: DefaultTheme,
}

export default theme
