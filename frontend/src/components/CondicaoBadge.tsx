import type { Condicao } from '../types'

// Chips de categoria — mint uniforme (DESIGN.md: "mint sustenta … chips de
// categoria"). A distinção entre condições fica no emoji + rótulo, não na cor:
// cor aqui é reservada para PRIORIDADE, que é o que a ACS lê primeiro no card.
const config: Record<Condicao, { label: string; emoji: string }> = {
  gestante:   { label: 'Gestante',   emoji: '🤰' },
  diabetico:  { label: 'Diabético',  emoji: '💉' },
  hipertenso: { label: 'Hipertenso', emoji: '❤️' },
  vulneravel: { label: 'Vulnerável', emoji: '🛡️' },
  crianca:    { label: 'Criança',    emoji: '👶' },
}

export function CondicaoBadge({ condicao }: { condicao: Condicao }) {
  const { label, emoji } = config[condicao]
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-secondary-container text-on-secondary-container">
      <span>{emoji}</span>
      {label}
    </span>
  )
}
