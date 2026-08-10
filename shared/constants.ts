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

// TIER_CORES e CONDICAO_CORES viviam aqui e foram removidos: contradiziam o
// DESIGN.md e ninguém mais os consome.
//
// TIER_CORES pintava o `habitual` de charcoal (#36454F) — exatamente a inversão
// de rampa que o 88a5129 consertou no PWA e que nunca chegou aqui, então o mapa
// do Expo ainda ia renderizar o bug. Cor de prioridade agora sai de
// shared/recipes.ts (PRIORIDADE), fonte única para badge e pin nos dois stacks.
//
// CONDICAO_CORES dava uma cor por condição clínica. O DESIGN.md define UM
// `chip-category` só, mint uniforme, e é de propósito: cor é reservada para
// prioridade, que é o que a ACS lê primeiro. A distinção entre condições fica no
// emoji e no rótulo. Ver `chipCategory` em shared/recipes.ts.
