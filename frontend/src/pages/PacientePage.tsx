import { useNavigate, useParams } from 'react-router-dom'
import { CondicaoBadge } from '../components/CondicaoBadge'
import { PrioridadeBadge } from '../components/PrioridadeBadge'
import { googleMapsUrl } from '../lib/supabaseAdapter'
import { usePacienteDetalhe } from '../hooks/usePacienteDetalhe'

export function PacientePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { paciente: p, loading, error } = usePacienteDetalhe(id)

  if (loading) {
    return (
      <div className="p-8 text-center text-on-surface-variant/70 text-sm">
        Carregando paciente…
      </div>
    )
  }

  if (error || !p) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        {error ? `Erro: ${error.message}` : 'Paciente não encontrado.'}
        <button onClick={() => navigate('/')} className="block mx-auto mt-4 text-primary underline">
          Voltar
        </button>
      </div>
    )
  }

  const ultimaVisitaFmt = p.ultimaVisita
    ? new Date(p.ultimaVisita + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Nunca visitado'

  const diasSemVisita = p.ultimaVisita
    ? Math.floor((Date.now() - new Date(p.ultimaVisita + 'T12:00:00').getTime()) / 86400000)
    : null

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-on-primary px-4 pt-10 pb-5">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-on-primary/70 text-sm mb-3"
        >
          ‹ Voltar à lista
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{p.nome}</h1>
            <p className="text-on-primary/70 text-sm mt-0.5">
              {p.faixaEtaria} anos · {p.sexo} · {p.racaCor}
            </p>
          </div>
          <PrioridadeBadge prioridade={p.prioridade} />
        </div>

        {p.condicoes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.condicoes.map((c) => (
              <CondicaoBadge key={c} condicao={c} />
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo rolável */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Motivo de prioridade */}
        <div className="bg-surface-bright rounded-2xl border border-surface-container-high p-4">
          <h2 className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wide mb-2">Motivo de prioridade</h2>
          <p className="text-sm text-on-surface leading-snug">{p.motivoPrioridade}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant/70">Score PRIO-ACS:</span>
            <span className="text-xs font-bold text-on-surface-variant">{p.prioScore}/100</span>
          </div>
        </div>

        {/* Localização */}
        <div className="bg-surface-bright rounded-2xl border border-surface-container-high p-4">
          <h2 className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wide mb-2">Localização</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface">
              📍 {p.distanciaKm.toFixed(1).replace('.', ',')} km da unidade
            </span>
            <a
              href={googleMapsUrl(p)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary font-semibold bg-surface-container px-3 py-1.5 rounded-lg"
            >
              Abrir no Maps →
            </a>
          </div>
        </div>

        {/* Histórico de visitas */}
        <div className="bg-surface-bright rounded-2xl border border-surface-container-high p-4">
          <h2 className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wide mb-2">Última visita</h2>
          <p className="text-sm text-on-surface">{ultimaVisitaFmt}</p>
          {diasSemVisita !== null && (
            <p className={`text-xs mt-1 font-medium ${diasSemVisita > 180 ? 'text-error-strong' : 'text-on-surface-variant/70'}`}>
              {diasSemVisita} dias sem visita
            </p>
          )}
        </div>

        {/* Último registro de hipertensão */}
        {p.ultimoRegistroHipertensao && (
          <div className="bg-warning-subtle rounded-2xl border border-warning-strong/30 p-4">
            <h2 className="text-xs font-semibold text-warning-strong uppercase tracking-wide mb-2">Último registro clínico</h2>
            <div className="space-y-1 text-sm text-on-surface">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Pressão aferida</span>
                <span className="font-semibold">{p.ultimoRegistroHipertensao.pressao} mmHg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Medicação</span>
                <span>{p.ultimoRegistroHipertensao.tomaMedicacao ? 'Toma' : 'Não toma'}</span>
              </div>
              {p.ultimoRegistroHipertensao.sintomas && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Sintomas</span>
                  <span>{p.ultimoRegistroHipertensao.sintomas}</span>
                </div>
              )}
              <p className="text-xs text-on-surface-variant/70 pt-1">
                Registrado em {new Date(p.ultimoRegistroHipertensao.dataRegistro + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Botão fixo na base */}
      <div className="px-4 py-4 bg-surface-bright border-t border-surface-container-high">
        <button
          onClick={() => navigate(`/visita/${p.id}`)}
          className="w-full bg-primary text-on-primary font-bold text-base py-4 rounded-2xl active:scale-[0.98] transition-transform"
        >
          Começar visita
        </button>
      </div>
    </div>
  )
}
