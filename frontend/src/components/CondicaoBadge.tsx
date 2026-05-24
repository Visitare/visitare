import type { Condicao } from '../types'

const config: Record<Condicao, { label: string; emoji: string; className: string }> = {
  gestante: { label: 'Gestante', emoji: '🤰', className: 'bg-pink-100 text-pink-700' },
  diabetico: { label: 'Diabético', emoji: '💉', className: 'bg-purple-100 text-purple-700' },
  hipertenso: { label: 'Hipertenso', emoji: '❤️', className: 'bg-blue-100 text-blue-700' },
  vulneravel: { label: 'Vulnerável', emoji: '🛡️', className: 'bg-amber-100 text-amber-700' },
  crianca: { label: 'Criança', emoji: '👶', className: 'bg-green-100 text-green-700' },
}

export function CondicaoBadge({ condicao }: { condicao: Condicao }) {
  const { label, emoji, className } = config[condicao]
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${className}`}>
      <span>{emoji}</span>
      {label}
    </span>
  )
}
