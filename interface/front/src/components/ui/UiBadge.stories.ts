import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiBadge from './UiBadge.vue'

const meta = { title: 'Interface/Badge', component: UiBadge, args: { label: 'Livrée' } } satisfies Meta<typeof UiBadge>
export default meta
type Story = StoryObj<typeof meta>

export const Information: Story = { args: { type: 'info', label: 'En cours' } }
export const Reussite: Story = { args: { type: 'success' } }
export const Avertissement: Story = { args: { type: 'warning', label: 'À vérifier' } }
export const Erreur: Story = { args: { type: 'error', label: 'Bloquée' } }
export const Nouveau: Story = { args: { type: 'new', label: 'Nouveau' } }
export const Petit: Story = { args: { small: true } }
