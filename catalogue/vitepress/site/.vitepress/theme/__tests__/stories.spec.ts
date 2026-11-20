// Annotations de Storybook (a11y, preview) chargées ici : les autres tests tournent hors navigateur.
import '../../../../vitest.setup'
import { describe, expect, it } from 'vitest'
import { composeStories } from '@storybook/vue3-vite'
import { violationsAccessibilite } from './accessibilite'

/**
 * Chaque story est aussi un test : rendu sans erreur (avec sa fonction play), puis contrôle
 * d'accessibilité axe-core sur ce qui est affiché. Une violation fait échouer la CI.
 */
type ModuleStories = Parameters<typeof composeStories>[0]
const modules = import.meta.glob<ModuleStories>('../components/**/*.stories.ts', { eager: true })
const stories = (module: ModuleStories) =>
  Object.entries(composeStories(module) as Record<string, { run: (contexte?: { canvasElement: HTMLElement }) => Promise<void> }>)

describe.each(Object.entries(modules))('%s', (_chemin, module) => {
  it.each(stories(module))('%s : rendu et accessibilité', async (_nom, story) => {
    // Une zone d'affichage neuve par story ; Storybook démonte la précédente (portails compris).
    const canvasElement = document.body.appendChild(document.createElement('div'))
    await story.run({ canvasElement })
    expect(await violationsAccessibilite(document.body)).toEqual([])
  })
})
