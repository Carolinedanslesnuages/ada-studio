import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiTableau from './UiTableau.vue'

const meta = {
  title: 'Interface/Tableau',
  component: UiTableau,
  args: {
    title: 'Projets créés',
    headers: ['Projet', 'Stories livrées'],
    rows: [
      ['Réservation de salles', 4],
      ['Annuaire', 2],
    ],
  },
} satisfies Meta<typeof UiTableau>
export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Vide: Story = { args: { rows: [] } }
export const SansLegendeVisible: Story = { args: { noCaption: true } }
