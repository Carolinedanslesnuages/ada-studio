import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiAccordeon from './UiAccordeon.vue'
import UiAccordeons from './UiAccordeons.vue'

const meta = {
  title: 'Interface/Accordéon',
  component: UiAccordeon,
  args: { title: 'Critères d’acceptation' },
  render: (args) => ({ components: { UiAccordeon }, setup: () => ({ args }), template: '<UiAccordeon v-bind="args"><p>Le formulaire refuse une date passée.</p></UiAccordeon>' }),
} satisfies Meta<typeof UiAccordeon>
export default meta
type Story = StoryObj<typeof meta>

export const Ferme: Story = {}
export const Ouvert: Story = { play: ({ canvasElement }) => canvasElement.querySelector('button')?.click() }
export const Survol: Story = { parameters: { pseudo: { hover: true } } }
export const Focus: Story = { play: ({ canvasElement }) => canvasElement.querySelector('button')?.focus() }
export const Groupe: Story = {
  render: () => ({
    components: { UiAccordeon, UiAccordeons },
    template: '<UiAccordeons :model-value="0"><UiAccordeon title="Première"><p>Contenu un.</p></UiAccordeon><UiAccordeon title="Seconde"><p>Contenu deux.</p></UiAccordeon></UiAccordeons>',
  }),
}
