import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiChoixMultiple from './UiChoixMultiple.vue'

const meta = {
  title: 'Interface/Choix multiple',
  component: UiChoixMultiple,
  args: {
    legend: 'Stories à créer',
    options: [
      { label: 'Réserver une salle', value: 'reserver' },
      { label: 'Annuler une réservation', value: 'annuler' },
    ],
  },
} satisfies Meta<typeof UiChoixMultiple>
export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Coches: Story = { args: { modelValue: ['reserver'] } }
export const Survol: Story = { parameters: { pseudo: { hover: true } } }
export const Focus: Story = { play: ({ canvasElement }) => canvasElement.querySelector('input')?.focus() }
export const Erreur: Story = { args: { errorMessage: 'Cochez au moins une story' } }
