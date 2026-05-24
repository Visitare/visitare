import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAcsAtual } from '../hooks/useAcsAtual'

interface AcsOption {
  profissional_id: string
  equipe_id: string
  n_pacientes: number
  n_gestantes: number
  n_cronicos: number
  n_vulneraveis: number
  n_visitas_2025: number
}

export function SelecionarAcsPage() {
  const navigate = useNavigate()
  const { setAcs } = useAcsAtual()
  const [opcoes, setOpcoes] = useState<AcsOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    supabase
      .rpc('acs_demo_options')
      .then(({ data, error: err }) => {
        if (err) setError(err as unknown as Error)
        else setOpcoes((data as AcsOption[]) ?? [])
        setLoading(false)
      })
  }, [])

  const escolher = (o: AcsOption) => {
    setAcs(o.profissional_id)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-blue-700 text-white px-4 pt-10 pb-5">
        <h1 className="text-2xl font-bold">Entrar como ACS</h1>
        <p className="text-blue-200 text-sm mt-1">
          Selecione a sua identidade — em produção vem do ConecteSUS.
        </p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading && (
          <div className="text-center text-slate-400 py-12 text-sm">
            Carregando equipes…
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        )}

        {!loading &&
          opcoes.map((o) => (
            <button
              key={o.profissional_id}
              onClick={() => escolher(o)}
              className="w-full text-left rounded-xl bg-white border border-slate-200 px-4 py-3 hover:border-blue-400 active:bg-blue-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800">
                    Profissional {o.profissional_id.slice(-5)}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    equipe {o.equipe_id.slice(0, 8)}…
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-right whitespace-nowrap">
                  {o.n_pacientes.toLocaleString('pt-BR')} pacientes
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-pink-50 text-pink-700 px-2 py-0.5">
                  {o.n_gestantes} gestantes
                </span>
                <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">
                  {o.n_cronicos} crônicos
                </span>
                <span className="rounded-full bg-purple-50 text-purple-700 px-2 py-0.5">
                  {o.n_vulneraveis} vulneráveis
                </span>
                <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">
                  {o.n_visitas_2025} visitas em 2025
                </span>
              </div>
            </button>
          ))}
      </div>
    </div>
  )
}
