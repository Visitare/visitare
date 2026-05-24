import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PrioridadeBadge } from '../components/PrioridadeBadge'
import { CondicaoBadge } from '../components/CondicaoBadge'
import { SyncBar } from '../components/SyncBar'
import { MapaVisitas } from '../components/MapaVisitas'
import { useSync } from '../hooks/useSync'
import { db } from '../db'
import { getPacientesSemana } from '../mockData'
import type { Paciente } from '../types'

const PROFISSIONAL_ID = 'acs-demo-001'
const NOME_ACS = 'Ana Paula'

const DIAS_PT: Record<string, string> = {
  '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb',
}

function formatarDia(iso: string): { nomeDia: string; numeroDia: string; ehHoje: boolean } {
  const d = new Date(iso + 'T12:00:00')
  const hoje = new Date().toISOString().split('T')[0]
  return {
    nomeDia: DIAS_PT[String(d.getDay())],
    numeroDia: String(d.getDate()).padStart(2, '0'),
    ehHoje: iso === hoje,
  }
}

export function ListaPage() {
  const navigate = useNavigate()
  const { pendentes, status, isOnline, sincronizar } = useSync()
  const [visitadosSemana, setVisitadosSemana] = useState<Set<string>>(new Set())
  const [aba, setAba] = useState<'lista' | 'mapa'>('lista')
  const [diaAtivo, setDiaAtivo] = useState<string>(() => {
    const hoje = new Date().toISOString().split('T')[0]
    const semanaTemp = getPacientesSemana()
    const dias = Array.from(semanaTemp.keys()).sort()
    return semanaTemp.has(hoje) ? hoje : (dias[0] ?? hoje)
  })

  const semana = getPacientesSemana()
  const diasOrdenados = Array.from(semana.keys()).sort()

  useEffect(() => {
    // carrega todos os registros da semana
    const inicio = diasOrdenados[0]
    const fim = diasOrdenados[diasOrdenados.length - 1]
    db.visitas
      .where('profissionalId')
      .equals(PROFISSIONAL_ID)
      .and((v) => v.dataVisita >= inicio && v.dataVisita <= fim)
      .toArray()
      .then((visitas) => setVisitadosSemana(new Set(visitas.map((v) => v.pacienteId))))
  }, [])

  const pacientesDia = semana.get(diaAtivo) ?? []
  const totalSemana = Array.from(semana.values()).flat().length
  const visitadosTotal = Array.from(semana.values())
    .flat()
    .filter((p) => visitadosSemana.has(p.id)).length

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-blue-700 text-white px-4 pt-10 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-sm">Semana atual</p>
            <h1 className="text-2xl font-bold mt-0.5">Olá, {NOME_ACS} 👋</h1>
            <p className="text-blue-200 text-sm mt-0.5">Clínica da Família Rocinha</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{visitadosTotal}</div>
            <div className="text-blue-200 text-xs">de {totalSemana} visitas</div>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-3 mb-4">
          <div className="h-1.5 bg-blue-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${totalSemana > 0 ? (visitadosTotal / totalSemana) * 100 : 0}%` }}
            />
          </div>
        </div>
        {/* Toggle Lista / Mapa */}
        <div className="flex bg-blue-800 rounded-xl p-1 gap-1">
          {(['lista', 'mapa'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                aba === a
                  ? 'bg-white text-blue-700'
                  : 'text-blue-200'
              }`}
            >
              {a === 'lista' ? '☰ Lista' : '🗺 Mapa'}
            </button>
          ))}
        </div>
      </div>

      {/* Seletor de dias — só na aba lista */}
      {aba === 'lista' && (
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {diasOrdenados.map((dia) => {
              const { nomeDia, numeroDia, ehHoje } = formatarDia(dia)
              const qtd = semana.get(dia)?.length ?? 0
              const visitados = semana.get(dia)?.filter((p) => visitadosSemana.has(p.id)).length ?? 0
              const ativo = dia === diaAtivo
              return (
                <button
                  key={dia}
                  onClick={() => setDiaAtivo(dia)}
                  className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-colors min-w-[52px] ${
                    ativo
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className={`text-xs font-medium ${ativo ? 'text-blue-200' : 'text-slate-400'}`}>
                    {nomeDia}
                  </span>
                  <span className={`text-lg font-bold leading-tight ${ehHoje && !ativo ? 'text-blue-600' : ''}`}>
                    {numeroDia}
                  </span>
                  <span className={`text-xs mt-0.5 ${ativo ? 'text-blue-200' : 'text-slate-400'}`}>
                    {visitados}/{qtd}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Sync bar */}
      <SyncBar pendentes={pendentes} status={status} isOnline={isOnline} onSync={sincronizar} />

      {/* Aba Mapa */}
      {aba === 'mapa' && (
        <div className="flex-1" style={{ minHeight: 0 }}>
          <MapaVisitas
            pacientes={Array.from(semana.values()).flat()}
            visitados={visitadosSemana}
          />
        </div>
      )}

      {/* Aba Lista */}
      {aba === 'lista' && (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            {pacientesDia.length} visitas planejadas
          </h2>
          <span className="text-xs text-slate-400">máx. 5/dia</span>
        </div>

        {pacientesDia.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            Nenhuma visita planejada para este dia.
          </div>
        )}

        {pacientesDia.map((paciente, i) => (
          <PacienteCard
            key={paciente.id}
            paciente={paciente}
            ordem={i + 1}
            visitado={visitadosSemana.has(paciente.id)}
            onClick={() => navigate(`/visita/${paciente.id}`)}
          />
        ))}
      </div>
      )}
    </div>
  )
}

interface CardProps {
  paciente: Paciente
  ordem: number
  visitado: boolean
  onClick: () => void
}

function PacienteCard({ paciente, ordem, visitado, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-200 p-4 active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            visitado
              ? 'bg-green-100 text-green-600'
              : paciente.prioridade === 'critica'
                ? 'bg-red-100 text-red-600'
                : paciente.prioridade === 'alta'
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-slate-100 text-slate-500'
          }`}
        >
          {visitado ? '✓' : ordem}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-base ${visitado ? 'text-slate-400' : 'text-slate-800'}`}>
              {paciente.nome}
            </span>
            {!visitado && <PrioridadeBadge prioridade={paciente.prioridade} />}
            {visitado && (
              <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                Visitado
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mt-1.5">
            {paciente.condicoes.map((c) => (
              <CondicaoBadge key={c} condicao={c} />
            ))}
          </div>

          {!visitado && (
            <p className="text-xs text-slate-500 mt-1.5 leading-snug">{paciente.motivoPrioridade}</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span>📍 {paciente.distanciaKm.toFixed(1).replace('.', ',')} km</span>
            <span>·</span>
            <span>{paciente.sexo[0]} · {paciente.faixaEtaria} anos</span>
          </div>
        </div>

        <span className="text-slate-300 text-lg flex-shrink-0">›</span>
      </div>
    </button>
  )
}
