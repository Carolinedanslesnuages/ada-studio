import { defineCustomElement } from 'vue'
import RechercheListe from './components/RechercheListe.ce.vue'

/**
 * Point d'entrée du fichier livré (dist/composant.js) : déclare la balise
 * <composant-__SLUG__>. Le nom contient un tiret (obligatoire pour un web component) ; il est
 * normalisé pour rester valide avant la personnalisation du projet.
 */
export const NOM_BALISE = 'composant-__SLUG__'.toLowerCase().replace(/[^a-z0-9-]/g, '')

if (!customElements.get(NOM_BALISE)) customElements.define(NOM_BALISE, defineCustomElement(RechercheListe))
