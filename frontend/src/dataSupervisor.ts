// Dados do gestor — gerados via scripts/gerar_lista_do_dia.py
// a partir dos parquets reais (equipe 0206636a / unidade def3447c).
// Fonte de verdade: out/dashboard_supervisor.json no repo raiz.

export type LinhaCuidado = 'gestantes' | 'criancas_0_6' | 'hipertensos' | 'diabeticos'

export interface CoberturaLinha {
  linha: LinhaCuidado
  alvo: number
  emDia: number
  atrasados: number
  pct: number
}

export interface IndicadoresPrevine {
  rankingEquipeEmHipertensos: number
  totalEquipesAmostra: number
  indicadoresTotal2026: number
  indicadoresBatidos: number | null
}

export interface AlertaCritico {
  tipo: 'gestante_alto_risco_alerta'
  pacienteIdHash: string
  nomeDisplay: string
  diasSemVisita: number | null
  eventoRecente60d: boolean
}

export interface DashboardSupervisor {
  unidadeNome: string
  equipeId: string
  equipeNomeCurto: string
  totalEquipesUnidade: number
  data: string
  coberturaPorLinha: CoberturaLinha[]
  indicadoresPrevine: IndicadoresPrevine
  pacientesNuncaVisitadosPct: number
  totalPacientesEquipe: number
  alertasCriticos: AlertaCritico[]
}

// Hash → nome display anonimizado (mesmo padrão da Lista do ACS).
// Os hashes vêm do parquet real; nomes display são fictícios.
export const DASHBOARD: DashboardSupervisor = {
  unidadeNome: 'Clínica da Família Rocinha',
  equipeId: '0206636a',
  equipeNomeCurto: 'Equipe 023',
  totalEquipesUnidade: 49,
  data: '2025-12-31',
  totalPacientesEquipe: 1042,
  coberturaPorLinha: [
    { linha: 'gestantes', alvo: 17, emDia: 15, atrasados: 2, pct: 88.2 },
    { linha: 'criancas_0_6', alvo: 69, emDia: 29, atrasados: 40, pct: 42.0 },
    { linha: 'hipertensos', alvo: 526, emDia: 309, atrasados: 217, pct: 58.7 },
    { linha: 'diabeticos', alvo: 240, emDia: 160, atrasados: 80, pct: 66.7 },
  ],
  indicadoresPrevine: {
    rankingEquipeEmHipertensos: 3,
    totalEquipesAmostra: 49,
    indicadoresTotal2026: 15,
    indicadoresBatidos: 11,
  },
  pacientesNuncaVisitadosPct: 34.1,
  alertasCriticos: [
    {
      tipo: 'gestante_alto_risco_alerta',
      pacienteIdHash: 'fa63054ad83cb0ae',
      nomeDisplay: 'Maria S.',
      diasSemVisita: 7,
      eventoRecente60d: true,
    },
    {
      tipo: 'gestante_alto_risco_alerta',
      pacienteIdHash: '80df1de25ee1cadb',
      nomeDisplay: 'Joana P.',
      diasSemVisita: 100,
      eventoRecente60d: false,
    },
    {
      tipo: 'gestante_alto_risco_alerta',
      pacienteIdHash: '66cdfbb9db1aadd9',
      nomeDisplay: 'Ana R.',
      diasSemVisita: null,
      eventoRecente60d: false,
    },
    {
      tipo: 'gestante_alto_risco_alerta',
      pacienteIdHash: '4d594d8316c2f94e',
      nomeDisplay: 'Carla M.',
      diasSemVisita: 20,
      eventoRecente60d: true,
    },
    {
      tipo: 'gestante_alto_risco_alerta',
      pacienteIdHash: '622e631d92f188df',
      nomeDisplay: 'Patrícia L.',
      diasSemVisita: 25,
      eventoRecente60d: true,
    },
  ],
}

export const LINHA_LABELS: Record<LinhaCuidado, { titulo: string; emoji: string }> = {
  gestantes: { titulo: 'Gestantes', emoji: '🤰' },
  criancas_0_6: { titulo: 'Crianças 0–6 anos', emoji: '👶' },
  hipertensos: { titulo: 'Hipertensos', emoji: '❤️' },
  diabeticos: { titulo: 'Diabéticos', emoji: '💉' },
}

// Cor da semáforo para % de cobertura.
// >= 85% verde, >= 65% amarelo, < 65% vermelho — padrão Previne Brasil indicativo.
export function corCobertura(pct: number): {
  bar: string
  text: string
  bg: string
  border: string
  label: string
} {
  if (pct >= 85)
    return {
      bar: 'bg-green-500',
      text: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: 'Em meta',
    }
  if (pct >= 65)
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      label: 'Atenção',
    }
  return {
    bar: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Crítico',
  }
}
