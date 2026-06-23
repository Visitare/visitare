/**
 * VISITARE — DESIGN TOKENS (espelho JS para Tailwind v3 / NativeWind)
 * Importado por: mobile/tailwind.config.ts
 * Espelho CSS em: shared/tokens.css (para site/ e frontend/)
 * Fonte narrativa: DESIGN.md
 *
 * AO ALTERAR UM TOKEN: mude aqui E em shared/tokens.css.
 * Os valores de cor são idênticos nos dois arquivos — qualquer
 * diferença é um bug.
 */

export const colors = {
  // Teal: PRIMARY (ação, marca, confiança institucional)
  'primary':      '#006D77',
  'primary-dark': '#00565E',
  'on-primary':   '#FFFEF1',

  // Mint: SECONDARY (sustenta, preenche área)
  'secondary':              '#83C5BE',
  'on-secondary':           '#13272A',
  'secondary-container':    '#C9E6E2',
  'on-secondary-container': '#13403C',

  // Coral: TERTIARY/ACCENT (acolhimento; NÃO urgência)
  'tertiary':              '#C66B4F',
  'on-tertiary':           '#2B0F07',
  'tertiary-container':    '#EAAFA0',
  'on-tertiary-container': '#5A2616',

  // Superfícies
  'surface':                '#FAF9F6',
  'surface-container':      '#EDF6F9',
  'surface-container-high': '#DDEBEF',
  'on-surface':             '#13272A',
  'on-surface-variant':     '#36454F',

  // Urgência / erro (vermelho ≠ coral)
  'error':              '#C62828',
  'on-error':           '#FFFEF1',
  'error-container':    '#F7D6D2',
  'on-error-container': '#5A1410',
  'error-strong':       '#B42318',

  // Contexto
  'success-subtle': '#E7F4EA',
  'success-strong': '#1F7A33',
  'warning-subtle': '#FBEEDA',
  'warning-strong': '#8A4A09',
  'info-subtle':    '#E4F0FB',
  'info-strong':    '#0369A1',
} as const

export const fontFamily = {
  // PWA e mobile: Prompt (geométrica, wordmark)
  sans:    ['Prompt_400Regular', 'System'],
  medium:  ['Prompt_500Medium', 'System'],
  semibold: ['Prompt_600SemiBold', 'System'],
  mono:    ['IBMPlexMono_500Medium', 'monospace'],
  // site/ usa Merriweather Sans (definido no CSS do Astro)
} as const

export const borderRadius = {
  sm:   '6px',
  md:   '10px',
  lg:   '14px',
  xl:   '20px',
  full: '9999px',
} as const

export type ColorToken = keyof typeof colors
