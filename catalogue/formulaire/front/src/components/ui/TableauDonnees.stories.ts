import type { Meta, StoryObj } from '@storybook/vue3-vite'
import TableauDonnees from './TableauDonnees.vue'

const meta = {
  title: 'Interface/Tableau de données',
  component: TableauDonnees,
  args: {
    titre: 'Réservations de la semaine',
    colonnes: [
      { cle: 'salle', libelle: 'Salle' },
      { cle: 'jour', libelle: 'Jour' },
      { cle: 'places', libelle: 'Places' },
    ],
    lignes: [
      { salle: 'Salle A', jour: 'Lundi', places: 12 },
      { salle: 'Salle B', jour: 'Mardi', places: 8 },
    ],
  },
} satisfies Meta<typeof TableauDonnees>

export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Chargement: Story = { args: { chargement: true } }
export const Vide: Story = { args: { lignes: [] } }
