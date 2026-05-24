import type { Prioridade } from '../types'

const config: Record<Prioridade, { label: string; className: string }> = {
  critica: { label: 'Crítico', className: 'bg-red-100 text-red-700 border border-red-200' },
  alta: { label: 'Alta', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  media: { label: 'Média', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  baixa: { label: 'Baixa', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const { label, className } = config[prioridade]
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  )
}
