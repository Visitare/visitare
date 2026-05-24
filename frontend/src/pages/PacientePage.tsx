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
      <div className="p-8 text-center text-slate-400 text-sm">
        Carregando paciente…
      </div>
    )
  }

  if (error || !p) {
    return (
      <div className="p-8 text-center text-slate-500">
        {error ? `Erro: ${error.message}` : 'Paciente não encontrado.'}
        <button onClick={() => navigate('/')} className="block mx-auto mt-4 text-blue-600 underline">
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
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-700 text-white px-4 pt-10 pb-5">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-blue-200 text-sm mb-3"
        >
          ‹ Voltar à lista
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{p.nome}</h1>
            <p className="text-blue-200 text-sm mt-0.5">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Motivo de prioridade</h2>
          <p className="text-sm text-slate-700 leading-snug">{p.motivoPrioridade}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Score PRIO-ACS:</span>
            <span className="text-xs font-bold text-slate-600">{p.prioScore}/100</span>
          </div>
        </div>

        {/* Localização */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Localização</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">
              📍 {p.distanciaKm.toFixed(1).replace('.', ',')} km da unidade
            </span>
            <a
              href={googleMapsUrl(p)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              Abrir no Maps →
            </a>
          </div>
        </div>

        {/* Histórico de visitas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Última visita</h2>
          <p className="text-sm text-slate-700">{ultimaVisitaFmt}</p>
          {diasSemVisita !== null && (
            <p className={`text-xs mt-1 font-medium ${diasSemVisita > 180 ? 'text-red-500' : 'text-slate-400'}`}>
              {diasSemVisita} dias sem visita
            </p>
          )}
        </div>

        {/* Último registro de hipertensão */}
        {p.ultimoRegistroHipertensao && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <h2 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Último registro clínico</h2>
            <div className="space-y-1 text-sm text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Pressão aferida</span>
                <span className="font-semibold">{p.ultimoRegistroHipertensao.pressao} mmHg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Medicação</span>
                <span>{p.ultimoRegistroHipertensao.tomaMedicacao ? 'Toma' : 'Não toma'}</span>
              </div>
              {p.ultimoRegistroHipertensao.sintomas && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Sintomas</span>
                  <span>{p.ultimoRegistroHipertensao.sintomas}</span>
                </div>
              )}
              <p className="text-xs text-slate-400 pt-1">
                Registrado em {new Date(p.ultimoRegistroHipertensao.dataRegistro + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Botão fixo na base */}
      <div className="px-4 py-4 bg-white border-t border-slate-200">
        <button
          onClick={() => navigate(`/visita/${p.id}`)}
          className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl active:scale-[0.98] transition-transform"
        >
          Começar visita
        </button>
      </div>
    </div>
  )
}
