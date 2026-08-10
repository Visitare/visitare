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
  // surface-bright: camada elevada (card sobre o papel ivory).
  // DESIGN.md proíbe branco puro — cards sobem um nível no ivory mais claro.
  'surface-bright':         '#FFFEF1',
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

/**
 * Escala tipográfica do DESIGN.md §Typography.
 *
 * Os TAMANHOS são compartilhados por todas as superfícies; só a FAMÍLIA muda
 * (site/ em Merriweather Sans, PWA e mobile em Prompt). Por isso a escala mora
 * aqui e as famílias ficam em cada superfície: `text-body-md` tem que querer
 * dizer 16px tanto no Tailwind do PWA quanto no NativeWind do Expo.
 */
export const fontSize = {
  'display':     '44px',
  'headline-lg': '32px',
  'headline-md': '24px',
  'title-lg':    '20px',
  'body-lg':     '18px',
  'body-md':     '16px',
  'label-md':    '14px',
  'label-sm':    '12px',
  'data-md':     '14px',
} as const

export const fontWeight = {
  'display':     '600',
  'headline-lg': '500',
  'headline-md': '500',
  'title-lg':    '600',
  'body-lg':     '400',
  'body-md':     '400',
  'label-md':    '500',
  'label-sm':    '500',
  'data-md':     '500',
} as const

export const letterSpacing = {
  'display':     '0.01em',
  'headline-lg': '0.01em',
  'label-md':    '0.01em',
} as const

/** Ritmo de 8px com meio-passo de 4px (DESIGN.md §Layout). */
export const spacing = {
  xxs:    '2px',
  xs:     '4px',
  base:   '8px',
  sm:     '12px',
  md:     '16px',
  lg:     '24px',
  xl:     '40px',
  xxl:    '64px',
  xxxl:   '96px',
  gutter: '16px',
  margin: '24px',
} as const

/**
 * Motion. O DESIGN.md pede profundidade por camadas tonais e nada de
 * decoração — então o vocabulário de movimento é curto de propósito.
 * `instant` é o feedback de toque (a mão está em movimento, na rua);
 * `enter`/`exit` são transições de tela; `deliberate` é para o que a ACS
 * precisa VER acontecer (sync concluído, visita salva).
 *
 * Web consome como CSS transition; native como Reanimated withTiming.
 * Mesmos nomes nos dois lados — é isso que impede a divergência.
 */
export const duration = {
  instant:    '80ms',
  enter:      '200ms',
  exit:       '160ms',
  deliberate: '320ms',
} as const

export const easing = {
  // Padrão: desacelera na chegada. Serve para quase tudo.
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  // Saída: acelera na partida, não precisa ser vista até o fim.
  exit:     'cubic-bezier(0.4, 0, 1, 1)',
  // Entrada de elemento que aparece do nada.
  enter:    'cubic-bezier(0, 0, 0, 1)',
} as const

export type ColorToken = keyof typeof colors
export type FontSizeToken = keyof typeof fontSize
export type SpacingToken = keyof typeof spacing
export type DurationToken = keyof typeof duration
