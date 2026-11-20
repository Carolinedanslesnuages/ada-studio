import type { PluginOption } from 'vite'
import UnoCSS from 'unocss/vite'

/** Extensions Vite du style choisi : UnoCSS (configuration dans uno.config.ts). */
export const pluginsStyle: PluginOption[] = [UnoCSS()]
