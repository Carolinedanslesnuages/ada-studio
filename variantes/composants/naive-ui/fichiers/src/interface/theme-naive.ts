import type { GlobalThemeOverrides } from 'naive-ui'

/** Thème de Naive UI recalé sur les jetons du projet (contrastes ≥ 4,5:1 sur blanc, vérifiés dans Storybook). */
export const themeProjet: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0f766e',
    primaryColorHover: '#115e59',
    primaryColorPressed: '#134e4a',
    primaryColorSuppl: '#115e59',
    errorColor: '#b42318',
    errorColorHover: '#912018',
    successColor: '#1a7f37',
    textColor1: '#1f2328',
    textColor2: '#1f2328',
    textColor3: '#57606a',
    placeholderColor: '#57606a',
    borderColor: '#6e7781',
    borderRadius: '0.5rem',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  // Défaut connu : pendant le chargement, le tableau pâlit ses en-têtes jusqu'à 3,1:1. À 0,85 : plus de 9:1.
  DataTable: { opacityLoading: '0.85' },
}
