import { useNavigate } from 'react-router-dom'
import {
  DASHBOARD,
  LINHA_LABELS,
  corCobertura,
  type CoberturaLinha,
  type AlertaCritico,
} from '../dataSupervisor'

export function SupervisorPage() {
  const navigate = useNavigate()
  const d = DASHBOARD

  const totalAlvo = d.coberturaPorLinha.reduce((s, l) => s + l.alvo, 0)
  const totalAtrasados = d.coberturaPorLinha.reduce((s, l) => s + l.atrasados, 0)
  const coberturaGeralPct = totalAlvo > 0 ? ((totalAlvo - totalAtrasados) / totalAlvo) * 100 : 0
  const previne = d.indicadoresPrevine

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-12">
      {/* Header */}
      <div className="bg-on-surface text-on-primary px-4 pt-10 pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Header escuro (on-surface): a tinta secundária aqui tem que ser
                CLARA, não on-surface-variant — senão é escuro sobre escuro. */}
            <p className="text-surface/70 text-xs uppercase tracking-wide">
              Painel de Gestão · {formatarData(d.data)}
            </p>
            <h1 className="text-xl font-bold mt-1 leading-tight">{d.unidadeNome}</h1>
            <p className="text-surface/70 text-sm mt-0.5">
              {d.equipeNomeCurto} · {d.totalPacientesEquipe.toLocaleString('pt-BR')} pacientes
              cadastrados
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex-shrink-0 text-xs bg-on-surface-variant hover:bg-on-surface-variant/80 text-surface px-3 py-1.5 rounded-full border border-surface/25"
          >
            ← Modo ACS
          </button>
        </div>
      </div>

      {/* KPI gigante — nunca visitados */}
      <div className="px-4 -mt-3">
        <div className="bg-surface-bright rounded-2xl shadow-sm border border-surface-container-high p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                Pacientes nunca visitados
              </p>
              <p className="text-4xl font-bold text-error-strong mt-1 leading-none">
                {d.pacientesNuncaVisitadosPct.toFixed(1).replace('.', ',')}%
              </p>
              <p className="text-xs text-on-surface-variant mt-2 leading-snug">
                {Math.round(d.totalPacientesEquipe * (d.pacientesNuncaVisitadosPct / 100))} de{' '}
                {d.totalPacientesEquipe.toLocaleString('pt-BR')} cadastrados sem nenhuma visita
                registrada no parquet
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center text-2xl flex-shrink-0">
              🏚️
            </div>
          </div>
        </div>
      </div>

      {/* KPIs secundários */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-3">
        <KpiCard
          label="Cobertura geral"
          value={`${coberturaGeralPct.toFixed(0)}%`}
          hint={`${totalAtrasados} pacientes atrasados`}
          accent={coberturaGeralPct >= 65 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Previne Brasil"
          value={
            previne.indicadoresBatidos != null
              ? `${previne.indicadoresBatidos}/${previne.indicadoresTotal2026}`
              : '—'
          }
          hint={`Ranking ${previne.rankingEquipeEmHipertensos}º de ${previne.totalEquipesAmostra} equipes`}
          accent="blue"
        />
      </div>

      {/* Cobertura por linha de cuidado */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
          Cobertura por linha de cuidado
        </h2>
        <div className="space-y-2.5">
          {d.coberturaPorLinha.map((linha) => (
            <LinhaCard key={linha.linha} linha={linha} />
          ))}
        </div>
      </div>

      {/* Alertas críticos */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
            Alertas críticos
          </h2>
          <span className="text-xs font-semibold text-error-strong bg-error-container px-2 py-0.5 rounded-full">
            {d.alertasCriticos.length} pendentes
          </span>
        </div>
        <p className="text-xs text-on-surface-variant/70 mb-3">
          Gestantes alto risco sem visita recente — encaminhar à equipe.
        </p>
        <div className="space-y-2">
          {d.alertasCriticos.map((a) => (
            <AlertaCard key={a.pacienteIdHash} alerta={a} />
          ))}
        </div>
      </div>

      {/* Rodapé com timestamp */}
      <div className="px-4 mt-8 text-center">
        <p className="text-xs text-on-surface-variant/70">
          Dados gerados em {formatarData(d.data)} · fonte: parquets SMS-Rio (anonimizado)
        </p>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint: string
  accent: 'blue' | 'amber' | 'red' | 'green'
}) {
  const accentText = {
    blue: 'text-primary',
    amber: 'text-warning-strong',
    red: 'text-error-strong',
    green: 'text-success-strong',
  }[accent]
  return (
    <div className="bg-surface-bright rounded-2xl shadow-sm border border-surface-container-high p-3">
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 leading-tight ${accentText}`}>{value}</p>
      <p className="text-xs text-on-surface-variant/70 mt-1 leading-snug">{hint}</p>
    </div>
  )
}

function LinhaCard({ linha }: { linha: CoberturaLinha }) {
  const cor = corCobertura(linha.pct)
  const meta = LINHA_LABELS[linha.linha]
  return (
    <div
      className={`bg-surface-bright rounded-2xl border ${cor.border} shadow-sm p-3.5`}
      data-linha={linha.linha}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{meta.emoji}</span>
          <span className="font-semibold text-on-surface truncate">{meta.titulo}</span>
        </div>
        <span
          className={`text-xs font-semibold ${cor.text} ${cor.bg} px-2 py-0.5 rounded-full whitespace-nowrap`}
        >
          {cor.label}
        </span>
      </div>

      <div className="flex items-baseline justify-between mt-2">
        <p className={`text-2xl font-bold ${cor.text}`}>
          {linha.pct.toFixed(1).replace('.', ',')}%
        </p>
        <p className="text-xs text-on-surface-variant">
          <span className="font-semibold text-on-surface">{linha.emDia}</span>
          <span className="text-on-surface-variant/70"> / {linha.alvo} em dia</span>
        </p>
      </div>

      <div className="mt-2 h-1.5 bg-surface-container rounded-full overflow-hidden">
        <div
          className={`h-full ${cor.bar} rounded-full transition-all`}
          style={{ width: `${Math.min(100, linha.pct)}%` }}
        />
      </div>

      {linha.atrasados > 0 && (
        <p className="text-xs text-on-surface-variant mt-2">
          <span className="font-medium text-error-strong">{linha.atrasados}</span> em atraso
        </p>
      )}
    </div>
  )
}

function AlertaCard({ alerta }: { alerta: AlertaCritico }) {
  const dias = alerta.diasSemVisita
  const urgente = (dias != null && dias >= 30) || alerta.eventoRecente60d

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-3.5 shadow-sm ${
        urgente ? 'bg-error-container border-error-strong/30' : 'bg-surface-bright border-surface-container-high'
      }`}
    >
      <div className="w-9 h-9 rounded-full bg-tertiary-container flex items-center justify-center text-lg flex-shrink-0">
        🤰
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-on-surface truncate">{alerta.nomeDisplay}</p>
          <span className="text-xs font-medium text-on-tertiary-container bg-tertiary-container px-1.5 py-0.5 rounded">
            Gestante AR
          </span>
          {alerta.eventoRecente60d && (
            <span className="text-xs font-medium text-on-error-container bg-error-container px-1.5 py-0.5 rounded">
              ⚠ UPA 60d
            </span>
          )}
        </div>
        <p className="text-xs text-on-surface-variant mt-1 leading-snug">
          {dias == null
            ? 'Sem visita registrada no parquet'
            : `${dias} ${dias === 1 ? 'dia' : 'dias'} sem visita`}
          {' · '}
          <span className="font-mono text-on-surface-variant/70">{alerta.pacienteIdHash.slice(0, 8)}…</span>
        </p>
      </div>
    </div>
  )
}

function formatarData(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
