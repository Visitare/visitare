import type { Prioridade } from '../types'
import { PRIORIDADE, badgePrioridade } from '../../../shared/recipes'

// Rótulo e cor vêm de shared/recipes.ts — a MESMA fonte que pinta o pin do mapa
// e que o Expo vai consumir. Antes este arquivo tinha a sua própria tabela, e o
// mapa tinha outra: `media` era pêssego aqui e mint lá, na mesma tela.
export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  return (
    <span className={badgePrioridade(prioridade)}>{PRIORIDADE[prioridade].label}</span>
  )
}
