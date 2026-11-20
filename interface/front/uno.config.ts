import { defineConfig, presetWind3 } from 'unocss'

/**
 * Design d’ADA studio avec UnoCSS : vert sarcelle sur fond clair, police du système, cartes
 * arrondies, en-tête flottant. Aucune couleur, police ni bloc-marque d’un site officiel.
 * Les composants Ui* (src/components/ui/) sont écrits avec ces utilitaires ; les « raccourcis »
 * ci-dessous donnent aux écrans un vocabulaire commun (bouton, encart, badge, titre-4…).
 */
/** Couleur principale : vert sarcelle (nuancier du plus clair, 50, au plus foncé, 900).
 *  primaire-700 #0f766e sur blanc : 5,5:1 ; primaire-800 #115e59 : 7,6:1. */
const primaire = {
  50: '#f0fdfa',
  100: '#ccfbf1',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#14b8a6',
  600: '#0d9488',
  700: '#0f766e',
  800: '#115e59',
  900: '#134e4a',
}

/** Jetons utilisés par les styles propres aux écrans (var(--app-…)). */
const jetons = `
:root {
  --app-primaire: ${primaire[700]};
  --app-primaire-survol: ${primaire[800]};
  --app-fond-primaire: ${primaire[50]};
  --app-texte: #1f2328;
  --app-texte-doux: #57606a;
  --app-texte-inverse: #ffffff;
  --app-fond: #ffffff;
  --app-fond-doux: #f6f7f9;
  --app-fond-survol: #eef1f4;
  --app-bordure: #d0d7de;
  --app-gris: #57606a;
  --app-succes: #1a7f37;
  --app-fond-succes: #ecfdf3;
  --app-avertissement: #9a6700;
  --app-fond-avertissement: #fff8e6;
  --app-erreur: #b42318;
  --app-fond-erreur: #fef3f2;
  --app-info: ${primaire[700]};
  --app-fond-info: ${primaire[50]};
  --app-rayon: 0.5rem;
  --app-police: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --app-titres: var(--app-police);
  --app-ombre: 0 1px 2px rgb(31 35 40 / 6%), 0 8px 24px rgb(31 35 40 / 7%);
  --app-focus: 0 0 0 2px #ffffff, 0 0 0 4px #7c3aed;
}
*, *::before, *::after { box-sizing: border-box; border-width: 0; border-style: solid; border-color: var(--app-bordure); }
html {
  font-family: var(--app-police);
  line-height: 1.5;
  color: var(--app-texte);
  background: var(--app-fond-doux);
}
body { margin: 0; }
h1, h2, h3, h4, h5, h6 { margin: 0 0 1rem; line-height: 1.2; font-family: var(--app-titres); font-weight: 600; letter-spacing: -0.01em; }
button, input, select, textarea { font-family: inherit; }
h1 { font-size: 2.5rem; }
h2 { font-size: 1.75rem; }
h3 { font-size: 1.375rem; }
p, ul, ol { margin: 0 0 1rem; }
figure { margin: 0; }
a { color: var(--app-primaire); text-underline-offset: 0.2em; }
a:hover { color: var(--app-primaire-survol); }
:focus-visible { outline: none; box-shadow: var(--app-focus); border-radius: 0.25rem; }
code { font-size: 0.9em; background: ${primaire[50]}; padding: 0.1em 0.35em; border-radius: 0.1875rem; }
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`

/** Espacements hérités : 1v = 0,25 rem, 1w = 0,5 rem (ex. mb-2w = 1 rem). */
const cotes: Record<string, string[]> = {
  '': [''],
  t: ['-top'],
  b: ['-bottom'],
  l: ['-left'],
  r: ['-right'],
  x: ['-left', '-right'],
  y: ['-top', '-bottom'],
}

export default defineConfig({
  presets: [presetWind3()],
  theme: { colors: { primaire } },
  preflights: [{ getCSS: () => jetons }],
  rules: [
    [
      /^([mp])([tblrxy]?)-(\d+)([wv])$/,
      ([, propriete, cote, nombre, unite]) => {
        const valeur = `${Number(nombre) * (unite === 'w' ? 0.5 : 0.25)}rem`
        const nom = propriete === 'm' ? 'margin' : 'padding'
        return Object.fromEntries((cotes[cote ?? ''] ?? ['']).map((suffixe) => [`${nom}${suffixe}`, valeur]))
      },
    ],
  ],
  shortcuts: {
    // Textes
    'titre-4': 'text-2xl font-semibold',
    'titre-5': 'text-xl font-semibold',
    'titre-6': 'text-lg font-semibold',
    'texte-intro': 'text-xl leading-relaxed',
    'texte-md': 'text-base',
    'texte-sm': 'text-sm',
    'texte-xs': 'text-xs',
    'texte-gras': 'font-bold',
    'visuellement-cache': 'sr-only',
    // Mise en page
    conteneur: 'max-w-6xl mx-auto px-4',
    'conteneur--fluide': 'w-full',
    grille: 'flex flex-wrap',
    'grille--gutters': 'gap-6',
    'grille--middle': 'items-center',
    'grille--bottom': 'items-end',
    col: 'flex-1 min-w-0',
    'col-auto': 'flex-none',
    'col-12': 'basis-full',
    'col-sm-6': 'basis-full sm:basis-[calc(50%-0.75rem)]',
    'col-md-6': 'basis-full md:basis-[calc(50%-0.75rem)]',
    'col-md-8': 'basis-full md:basis-[66.66%]',
    'col-lg-3': 'basis-full lg:basis-[calc(25%-1.125rem)]',
    'col-lg-4': 'basis-full lg:basis-[calc(33.33%-1rem)]',
    'col-lg-6': 'basis-full lg:basis-[calc(50%-0.75rem)]',
    'col-lg-8': 'basis-full lg:basis-[calc(66.66%-0.5rem)]',
    // En-tête, pied, liens
    'lien-evitement':
      'absolute left-4 -top-12 z-10 rounded-md bg-white px-4 py-2 font-semibold text-primaire-700 shadow-md focus:top-4',
    entete: 'sticky top-0 z-20 w-full bg-white/90 backdrop-blur border-0 border-b border-solid border-[var(--app-bordure)] shadow-[var(--app-ombre)]',
    'entete__interieur': 'flex flex-wrap items-center justify-between gap-4 px-8 py-3',
    'entete__marque': 'flex items-center gap-3 no-underline text-[var(--app-texte)]',
    'entete__sigle': 'font-[var(--app-titres)] text-2xl font-semibold tracking-[0.14em] text-primaire-700',
    'badge-edition':
      'inline-flex items-center rounded-full bg-primaire-700 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white',
    message: 'm-0 text-sm font-semibold',
    'message--avertissement': 'text-[var(--app-avertissement)]',
    tableau: 'w-full',
    'entete__nom': 'hidden md:inline border-0 border-l border-solid border-[var(--app-bordure)] pl-3 text-sm text-[var(--app-texte-doux)]',
    'entete__sous-titre': 'block text-sm font-normal text-stone-600',
    'entete__liens': 'flex flex-wrap items-center gap-x-2 gap-y-1',
    'lien-rapide':
      'inline-flex items-center gap-1.5 rounded-md border-0 bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--app-texte)] no-underline cursor-pointer hover:bg-primaire-50 hover:text-primaire-800 [&[aria-current=page]]:bg-primaire-50 [&[aria-current=page]]:text-primaire-800',
    pied: 'mt-16 bg-transparent',
    'pied__interieur': 'flex flex-wrap items-center justify-center gap-6 px-8 pb-10 text-center text-[var(--app-texte-doux)] [&_p]:m-0',
    lien: 'font-medium text-primaire-700 underline underline-offset-3 hover:text-primaire-800',
    'lien--sm': 'text-sm',
    // Boutons
    bouton:
      'inline-flex items-center justify-center gap-2 rounded-lg border-0 bg-primaire-700 px-5 py-2.5 font-semibold text-white no-underline shadow-[0_4px_14px_rgba(15,118,110,0.25)] cursor-pointer transition hover:-translate-y-px hover:bg-primaire-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0',
    'bouton--secondaire': '!bg-primaire-50 !text-primaire-800 !shadow-none hover:!bg-primaire-100',
    'bouton--secondary': 'bouton--secondaire',
    'bouton--tertiaire': '!bg-transparent !text-primaire-800 !shadow-none hover:!bg-primaire-50 hover:!translate-y-0',
    'bouton--tertiary': 'bouton--tertiaire',
    'bouton--sm': 'px-3.5 py-1.5 text-sm',
    'bouton--md': '',
    'bouton--lg': 'px-7 py-3.5 text-lg',
    'groupe-boutons': 'm-0 flex list-none flex-wrap items-center gap-3 p-0',
    'groupe-boutons--sm': '[&_.bouton]:px-3.5 [&_.bouton]:py-1.5 [&_.bouton]:text-sm',
    // Encart, badges
    encart: 'mb-6 rounded-xl bg-white p-6 shadow-[var(--app-ombre)]',
    'encart__titre': 'mb-2 font-[var(--app-titres)] text-xl font-semibold',
    'encart__texte': 'mb-0',
    badge: 'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold',
    'badge--info': 'bg-primaire-100 text-primaire-800',
    'badge--success': 'bg-green-100 text-green-800',
    'badge--warning': 'bg-yellow-100 text-yellow-900',
    'badge--new': 'bg-stone-200 text-stone-800',
    'badge--error': 'bg-red-100 text-red-800',
    'badge--sm': 'px-2 py-0 text-[0.7rem]',
    'badge--petit': 'badge--sm',
    // Champs et choix (utilisés aussi hors composants)
    'champ__etiquette': 'mb-1.5 block font-semibold',
    'champ__aide': 'mt-0.5 block text-sm font-normal text-stone-600',
    'champ__erreur': 'mt-1.5 mb-0 text-sm font-semibold text-red-700',
    'groupe-choix': 'mb-6 min-w-0 border-0 p-0',
    'groupe-choix--erreur': '!border-0 !border-l-4 !border-solid !border-red-700 !pl-4',
    'groupe-choix__legende': 'mb-3 p-0 font-semibold',
    'groupe-choix__legende--normale': 'font-normal',
    'groupe-choix__element': 'mb-2',
    choix: 'mb-2 flex items-start gap-2.5',
  },
})
