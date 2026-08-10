/**
 * VISITARE — RECEITAS DE COMPONENTE
 *
 * Class strings derivadas do bloco `components:` do DESIGN.md, consumidas pelo
 * Tailwind v4 do PWA (frontend/) E pelo NativeWind do Expo (mobile/). É a
 * camada que faz um badge no web e um badge no native serem a mesma decisão de
 * design, e não duas interpretações da mesma spec.
 *
 * FONTE NARRATIVA: DESIGN.md. Se uma receita aqui discorda do DESIGN.md, o
 * DESIGN.md ganha — ele é a spec, isto é a implementação dela.
 *
 * ── Regras para escrever receita que resolve nos DOIS stacks ──────────────
 *
 * 1. `flex flex-row` / `flex flex-col` SEMPRE, o PAR completo. No web o default
 *    de flex-direction é row e no React Native é column, então a direção tem
 *    que ser explícita; e `flex-row` sozinho NÃO liga display:flex no web (um
 *    <span> continua inline e o layout quebra), enquanto no native o View já é
 *    flex e o erro passaria batido. Os dois juntos resolvem nos dois stacks.
 * 2. `gap-*`, nunca `space-x-*` / `space-y-*` — as utilities de space-between
 *    não têm equivalente confiável no NativeWind.
 * 3. Peso via `font-medium` / `font-semibold`, nunca via token de fontWeight.
 *    No web é propriedade CSS; no native é outro arquivo de fonte (mapeado em
 *    fontFamily). Essas duas classes coincidem nos dois; as demais, não.
 * 4. Só tokens da escala compartilhada (`p-lg`, `text-body-md`, `rounded-xl`).
 *    Valor arbitrário (`p-[13px]`) não é garantido no NativeWind e, pior, foge
 *    do ritmo de 8px do DESIGN.md §Layout.
 * 5. Nada de `hover:` como único portador de significado — no celular da ACS
 *    não existe hover. Estado de toque é `active:`.
 */

import { colors } from './tokens'

// ── Botões ────────────────────────────────────────────────────────────────
// CTA de trabalho é teal. Coral é acento de marca, com parcimônia. Vermelho
// sólido só para ação destrutiva (DESIGN.md §Components).

export const buttonPrimary =
  'flex flex-row items-center justify-center gap-base bg-primary text-on-primary text-label-md font-medium rounded-lg p-md active:bg-primary-dark'

export const buttonSecondary =
  'flex flex-row items-center justify-center gap-base bg-secondary text-on-secondary text-label-md font-medium rounded-lg p-md'

export const buttonAccent =
  'flex flex-row items-center justify-center gap-base bg-tertiary text-on-tertiary text-label-md font-medium rounded-lg p-md'

export const buttonDanger =
  'flex flex-row items-center justify-center gap-base bg-error text-on-error text-label-md font-medium rounded-lg p-md'

// ── Superfícies ───────────────────────────────────────────────────────────
// Profundidade por camada tonal, não por sombra pesada (DESIGN.md §Elevation).

export const card = 'bg-surface-bright rounded-xl p-lg'
export const sectionMuted = 'bg-secondary text-on-secondary rounded-xl p-lg'
export const listItemVisit = 'rounded-md p-sm'
export const inputField =
  'bg-surface-container text-on-surface text-body-md rounded-md p-sm'

// ── Chips de categoria ────────────────────────────────────────────────────
// UM estilo só, mint uniforme. A distinção entre condições clínicas fica no
// emoji e no rótulo — cor é reservada para PRIORIDADE, que é o que a ACS lê
// primeiro. O DESIGN.md define um único `chip-category`, e é de propósito.

export const chipCategory =
  'flex flex-row items-center gap-xs bg-secondary-container text-on-secondary-container text-label-sm font-medium rounded-full px-base py-xxs'

// ── Alerts de contexto ────────────────────────────────────────────────────
// Fundo subtle + texto/borda strong. Nunca solid: informa sem gritar.

export const alertSuccess = 'bg-success-subtle text-success-strong text-label-md rounded-md p-sm'
export const alertWarning = 'bg-warning-subtle text-warning-strong text-label-md rounded-md p-sm'
export const alertInfo = 'bg-info-subtle text-info-strong text-label-md rounded-md p-sm'
export const alertError = 'bg-error-container text-error-strong text-label-md rounded-md p-sm'

// ── Dados tabulares ───────────────────────────────────────────────────────
// Número que alinha em coluna pede mono; texto narrativo, nunca.

export const dataTimestamp = 'font-mono text-data-md text-on-surface-variant'

// ── Prioridade ────────────────────────────────────────────────────────────
/**
 * FONTE ÚNICA da leitura de prioridade — badge e pin do mapa saem daqui, então
 * não podem discordar. Antes discordavam: o badge pintava `media` de pêssego e
 * o mapa de mint, na mesma tela.
 *
 * `badge` segue a regra de contexto do DESIGN.md (fundo subtle + tinta strong).
 * `dot` é outro eixo de propósito: um pin de 22px na rua, sob sol, precisa de
 * cor SÓLIDA para existir.
 *
 * A rampa do pin NÃO é monotônica em luminância, e não deve ser: #8A4A09 (âmbar)
 * é mais escuro que #C62828 (vermelho). No topo da escala quem carrega urgência
 * é o MATIZ — vermelho é perigo, e o DESIGN.md separa vermelho de coral
 * justamente para proteger essa leitura. O invariante é outro: o par de ALARME
 * (critica, alta) tem que ser inequivocamente mais pesado que o par CALMO
 * (media, baixa), e dentro do par calmo o peso cai. Era o par calmo que estava
 * invertido antes (charcoal em `baixa` pesava mais que o mint de `media`).
 * frontend/test/tokens-drift.test.ts trava os dois lados disso por luminância.
 *
 * Os 4 níveis são a banda de APRESENTAÇÃO derivada do `tier` do banco
 * (high/medium/routine, ver docs/naming-map.md): `high` se abre em
 * critica/alta por score, e medium/routine viram media/baixa.
 */
export const PRIORIDADE = {
  critica: {
    // Feminino: concorda com "prioridade", como "Alta" e "Média". O badge dizia
    // "Crítico" e a legenda do mapa dizia "Crítica" — mesma escala, duas grafias.
    label: 'Crítica',
    badge: 'bg-error-container text-on-error-container',
    dot: colors['error'],
  },
  alta: {
    label: 'Alta',
    badge: 'bg-warning-subtle text-warning-strong',
    dot: colors['warning-strong'],
  },
  media: {
    label: 'Média',
    badge: 'bg-tertiary-container text-on-tertiary-container',
    dot: colors['tertiary-container'],
  },
  baixa: {
    label: 'Baixa',
    badge: 'bg-surface-container-high text-on-surface-variant',
    dot: colors['surface-container-high'],
  },
} as const

/** Ordem da escala, do mais urgente ao menos. O teste de rampa depende dela. */
export const PRIORIDADE_ORDEM = ['critica', 'alta', 'media', 'baixa'] as const

/** Visita já registrada sai da escala de urgência: virou verde de concluído. */
export const COR_VISITADO = colors['success-strong']

/** O badge completo, pronto para uso nos dois stacks. */
export const badgePrioridade = (nivel: keyof typeof PRIORIDADE) =>
  `${PRIORIDADE[nivel].badge} text-label-sm font-semibold rounded-full px-base py-xxs`
