import type { Meta, StoryObj } from '@storybook/vue3-vite'
import ChampSaisie from './ChampSaisie.vue'

const meta = {
  title: 'Interface/Champ de saisie',
  component: ChampSaisie,
  args: { label: 'Adresse électronique', type: 'email', aide: 'Exemple : nom@domaine.fr' },
} satisfies Meta<typeof ChampSaisie>

export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Obligatoire: Story = { args: { requis: true } }
export const Focus: Story = {
  play: ({ canvasElement }) => canvasElement.querySelector('input')?.focus(),
}
export const Desactive: Story = { args: { disabled: true } }
export const Erreur: Story = { args: { erreur: 'Saisissez une adresse au format nom@domaine.fr' } }
export const Vide: Story = { args: { aide: undefined } }
