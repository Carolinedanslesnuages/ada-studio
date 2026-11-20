import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiChoixUnique from './UiChoixUnique.vue'

const meta = {
  title: 'Interface/Choix unique',
  component: UiChoixUnique,
  args: {
    legend: 'Visibilité du dépôt',
    name: 'visibilite',
    options: [
      { label: 'Privé', value: 'prive', hint: 'Seuls vous et vos invités voient le dépôt.' },
      { label: 'Public', value: 'public', hint: 'Tout le monde voit le code.' },
    ],
  },
} satisfies Meta<typeof UiChoixUnique>
export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Choisi: Story = { args: { modelValue: 'prive' } }
export const Survol: Story = { parameters: { pseudo: { hover: true } } }
export const Focus: Story = { play: ({ canvasElement }) => canvasElement.querySelector('input')?.focus() }
export const Erreur: Story = { args: { errorMessage: 'Choisissez une visibilité' } }
