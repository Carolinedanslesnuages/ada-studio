import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { NOM_BALISE } from '@/composant'

/** Le composant tel qu'un site hôte l'intègre : la vraie balise, ses attributs, son Shadow DOM. */
type Attributs = { titre?: string; libelle: string; elements: string }

const meta = {
  title: 'Composant/Recherche dans une liste',
  args: { titre: 'Villes', libelle: 'Rechercher une ville', elements: '["Lille","Lyon","Nantes"]' },
  render: (args) => ({
    setup: () => ({ args }),
    template: `<${NOM_BALISE} :titre="args.titre" :libelle="args.libelle" :elements="args.elements" />`,
  }),
} satisfies Meta<Attributs>

export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const SansTitre: Story = { args: { titre: undefined } }
export const Vide: Story = { args: { elements: '[]' } }
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await new Promise((resoudre) => setTimeout(resoudre))
    canvasElement.querySelector(NOM_BALISE)?.shadowRoot?.querySelector('input')?.focus()
  },
}
