import type { Meta, StoryObj } from '@storybook/vue3-vite'
import BoutonAction from './BoutonAction.vue'

const meta = {
  title: 'Interface/Bouton',
  component: BoutonAction,
  args: { label: 'Enregistrer' },
} satisfies Meta<typeof BoutonAction>

export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Secondaire: Story = { args: { variante: 'secondaire', label: 'Annuler' } }
export const Focus: Story = {
  play: ({ canvasElement }) => canvasElement.querySelector('button')?.focus(),
}
export const Desactive: Story = { args: { disabled: true } }
export const Chargement: Story = { args: { chargement: true, label: 'Enregistrement' } }
