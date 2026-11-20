import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiChamp from './UiChamp.vue'

const meta = {
  title: 'Interface/Champ',
  component: UiChamp,
  args: { label: 'Nom du projet', hint: 'Exemple : Réservation de salles' },
} satisfies Meta<typeof UiChamp>
export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Survol: Story = { parameters: { pseudo: { hover: true } } }
export const Focus: Story = { play: ({ canvasElement }) => canvasElement.querySelector('input')?.focus() }
export const Desactive: Story = { args: { disabled: true } as Record<string, unknown> }
export const Erreur: Story = { args: { errorMessage: 'Le nom doit faire au moins 3 caractères' } }
export const ZoneDeTexte: Story = { args: { label: 'Votre idée', isTextarea: true, hint: 'Racontez-la comme elle vient' } }
