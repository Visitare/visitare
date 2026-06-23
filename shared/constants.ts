// Constantes compartilhadas entre PWA e Expo.
// Sem imports de framework — funciona em qualquer runtime JS.

export const SUPABASE_URL = 'https://gyutcqmrbbtftrowcyhv.supabase.co'

// Demo: equipe com variedade clínica (gestantes + crônicos).
// Em produção, vem do JWT do ACS (claim equipe_id).
export const DEMO_EQUIPE_ID =
  '0206636a6ea8f41ca0160ee7655cacacf2a83bfd5974400d8be1a691ba293c87'

// Data de referência: fim do dataset anonimizado (date-shifted).
export const REF_DATE = '2025-12-31'

// Nomes determinísticos para o dataset anonimizado.
export const NOMES_FEMININOS = [
  'Maria', 'Ana', 'Camila', 'Luciana', 'Carla',
  'Patricia', 'Fernanda', 'Juliana', 'Beatriz', 'Sandra',
]
export const NOMES_MASCULINOS = [
  'Daniel', 'Pedro', 'Thiago', 'Antonio', 'Rafael',
  'Lucas', 'Marcos', 'Eduardo', 'Roberto', 'Felipe',
]
export const LETRAS_SOBRENOME = 'ABCDEFGHIJKLMNOPRSTV'

// Tiers PRIO-ACS
export const TIER_LABELS = {
  alto: 'Semanal',
  medio: 'Quinzenal a mensal',
  habitual: 'Mensal',
} as const

// Gaps oficiais em dias por cadência (Manual ACS / Portaria SAS/MS 221/2000)
export const GAP_LIMITES = {
  gestante: 30,
  crianca_0_6: 45,
  cronico: 90,
  geral: 180,
} as const

// Cores semânticas dos tiers (usadas em badges e mapa)
export const TIER_CORES = {
  alto: { bg: 'bg-error-container', text: 'text-error-strong', dot: '#C62828' },
  medio: { bg: 'bg-warning-subtle', text: 'text-warning-strong', dot: '#8A4A09' },
  habitual: { bg: 'bg-surface-container', text: 'text-on-surface-variant', dot: '#36454F' },
} as const

// Cores das condições clínicas nos badges
export const CONDICAO_CORES = {
  gestante: { bg: 'bg-secondary-container', text: 'text-on-secondary-container' },
  diabetico: { bg: 'bg-info-subtle', text: 'text-info-strong' },
  hipertenso: { bg: 'bg-warning-subtle', text: 'text-warning-strong' },
  vulneravel: { bg: 'bg-error-container', text: 'text-error-strong' },
  crianca: { bg: 'bg-success-subtle', text: 'text-success-strong' },
} as const
