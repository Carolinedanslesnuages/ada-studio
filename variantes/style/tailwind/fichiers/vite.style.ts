import type { PluginOption } from 'vite'
import tailwindcss from '@tailwindcss/vite'

/** Extensions Vite du style choisi : Tailwind CSS 4. */
export const pluginsStyle: PluginOption[] = [tailwindcss()]
