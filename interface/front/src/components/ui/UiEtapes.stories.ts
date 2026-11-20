import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiEtapes from './UiEtapes.vue'

const meta = {
  title: 'Interface/Étapes',
  component: UiEtapes,
  args: { steps: ['Votre idée', 'Type de projet et stack', 'Nom et présentation'], currentStep: 1 },
} satisfies Meta<typeof UiEtapes>
export default meta
type Story = StoryObj<typeof meta>

export const Premiere: Story = {}
export const Milieu: Story = { args: { currentStep: 2 } }
export const Derniere: Story = { args: { currentStep: 3 } }
