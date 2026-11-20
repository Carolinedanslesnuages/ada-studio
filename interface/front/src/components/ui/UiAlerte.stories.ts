import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiAlerte from './UiAlerte.vue'

const meta = {
  title: 'Interface/Alerte',
  component: UiAlerte,
  args: { title: 'Projet créé', description: 'ADA studio lit votre idée et vous pose ses questions.' },
} satisfies Meta<typeof UiAlerte>
export default meta
type Story = StoryObj<typeof meta>

export const Information: Story = { args: { type: 'info' } }
export const Reussite: Story = { args: { type: 'success' } }
export const Avertissement: Story = { args: { type: 'warning', title: 'Contrôles en cours' } }
export const Erreur: Story = { args: { type: 'error', title: 'Création impossible', description: 'GitHub ne répond pas : réessayez.' } }
export const Petite: Story = { args: { small: true, title: undefined } }
