import type { Meta, StoryObj } from '@storybook/vue3-vite'
import BoutonAction from './BoutonAction.vue'
import FenetreDialogue from './FenetreDialogue.vue'

const meta = {
  title: 'Interface/Fenêtre de dialogue',
  component: FenetreDialogue,
  args: { titre: 'Supprimer la réservation ?', ouvert: true },
  render: (args) => ({
    components: { BoutonAction, FenetreDialogue },
    setup: () => ({ args }),
    template: `
      <FenetreDialogue v-bind="args" v-model:ouvert="args.ouvert">
        <p>La réservation sera supprimée définitivement.</p>
        <template #actions><BoutonAction label="Supprimer" /></template>
      </FenetreDialogue>`,
  }),
} satisfies Meta<typeof FenetreDialogue>

export default meta
type Story = StoryObj<typeof meta>

export const Ouverte: Story = {}
export const Fermee: Story = { args: { ouvert: false } }
