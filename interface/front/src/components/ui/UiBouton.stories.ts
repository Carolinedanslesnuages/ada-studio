import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiBouton from './UiBouton.vue'

const meta = { title: 'Interface/Bouton', component: UiBouton, args: { label: 'Créer le projet' } } satisfies Meta<typeof UiBouton>
export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Survol: Story = { parameters: { pseudo: { hover: true } } }
export const Focus: Story = { play: ({ canvasElement }) => canvasElement.querySelector('button')?.focus() }
export const Desactive: Story = { args: { disabled: true } }
export const Chargement: Story = { args: { chargement: true, label: 'Création en cours' } }
export const Secondaire: Story = { args: { secondary: true, label: 'Annuler' } }
export const Tertiaire: Story = { args: { tertiary: true, label: 'Recharger', icon: 'icone-refresh-line' } }
export const AvecIcone: Story = { args: { icon: 'icone-add-line', label: 'Nouveau projet' } }
export const Petit: Story = { args: { size: 'sm' } }
