import { defineConfig } from 'vitepress'

/** Réglages du site : en français, recherche intégrée, libellés de navigation traduits. */
export default defineConfig({
  lang: 'fr-FR',
  title: '__NOM_PROJET__',
  description: '__OBJECTIF__',
  cleanUrls: true,
  // Un lien vers une page absente fait échouer la construction (vérifié en CI).
  ignoreDeadLinks: false,
  // Thème clair seulement : le bouton clair/sombre de VitePress n'a pas de nom accessible avant
  // le chargement de la page (RGAA 11.9). Couleurs du projet (jetons --app-*).
  appearance: false,
  head: [['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }]],
  themeConfig: {
    nav: [
      { text: 'Accueil', link: '/' },
      { text: 'Guide', link: '/guide/demarrer' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Démarrer', link: '/guide/demarrer' },
          { text: 'Écrire une page', link: '/guide/ecrire-une-page' },
        ],
      },
    ],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Rechercher', buttonAriaLabel: 'Rechercher dans la documentation' },
          modal: {
            displayDetails: 'Afficher la liste détaillée',
            resetButtonTitle: 'Effacer la recherche',
            backButtonTitle: 'Fermer la recherche',
            noResultsText: 'Aucun résultat pour',
            footer: { selectText: 'pour choisir', navigateText: 'pour naviguer', closeText: 'pour fermer' },
          },
        },
      },
    },
    outline: { label: 'Sur cette page', level: [2, 3] },
    // Pas de bloc « page précédente / suivante » : VitePress le balise comme un second pied de page
    // (deux « contentinfo », RGAA 12.6). La navigation passe par le menu latéral.
    docFooter: { prev: false, next: false },
    sidebarMenuLabel: 'Menu',
    returnToTopLabel: 'Retour en haut de page',
    langMenuLabel: 'Changer de langue',
    skipToContentLabel: 'Aller au contenu',
    notFound: {
      title: 'Page introuvable',
      quote: 'L’adresse est peut-être erronée, ou la page a été déplacée.',
      linkLabel: 'Revenir à l’accueil',
      linkText: 'Revenir à l’accueil',
    },
    footer: { message: 'Documentation de __NOM_PROJET__. Données fictives uniquement.' },
  },
})
