import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiListe from './UiListe.vue'

const meta = {
  title: 'Interface/Liste déroulante',
  component: UiListe,
  args: { label: 'Stack la plus proche', options: ['Vue 3 + NestJS', 'Vue 3 + Node.js', 'Python (Django)'], hint: 'Facultatif' },
} satisfies Meta<typeof UiListe>
export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Survol: Story = { parameters: { pseudo: { hover: true } } }
export const Focus: Story = { play: ({ canvasElement }) => canvasElement.querySelector('select')?.focus() }
export const Erreur: Story = { args: { errorMessage: 'Choisissez une stack' } }
export const OptionDesactivee: Story = {
  args: { options: [{ value: 'a', text: 'Disponible' }, { value: 'b', text: 'Bientôt', disabled: true }] },
}
