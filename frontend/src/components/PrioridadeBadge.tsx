import type { Prioridade } from '../types'

// Tiers de prioridade (DESIGN.md §Components): urgência é VERMELHO, nunca o
// coral de marca. Degradê de alarme: vermelho → âmbar → pêssego → neutro.
const config: Record<Prioridade, { label: string; className: string }> = {
  critica: { label: 'Crítico', className: 'bg-error-container text-on-error-container border border-error-strong/40' },
  alta:    { label: 'Alta',    className: 'bg-warning-subtle text-warning-strong border border-warning-strong/30' },
  media:   { label: 'Média',   className: 'bg-tertiary-container text-on-tertiary-container border border-on-tertiary-container/20' },
  baixa:   { label: 'Baixa',   className: 'bg-surface-container text-on-surface-variant border border-surface-container-high' },
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const { label, className } = config[prioridade]
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  )
}
