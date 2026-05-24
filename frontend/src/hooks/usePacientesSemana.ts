import { useCallback, useEffect, useState } from 'react'
import type { Paciente } from '../types'
import { REF_DATE, supabase } from '../lib/supabase'
import { distribuirSemana, fetchPacientesPriorizados } from '../lib/supabaseAdapter'

interface State {
  semana: Map<string, Paciente[]>
  pacientes: Paciente[]
  loading: boolean
  error: Error | null
}

const EMPTY: State = {
  semana: new Map(),
  pacientes: [],
  loading: false,
  error: null,
}

export function usePacientesSemana(equipeId: string | null) {
  const [state, setState] = useState<State>({ ...EMPTY, loading: !!equipeId })

  const carregar = useCallback(async () => {
    if (!equipeId) {
      setState(EMPTY)
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const pacientes = await fetchPacientesPriorizados(equipeId, REF_DATE)
      setState({
        semana: distribuirSemana(pacientes),
        pacientes,
        loading: false,
        error: null,
      })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e as Error }))
    }
  }, [equipeId])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!equipeId) return
    const channel = supabase
      .channel(`equipe-${equipeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'visitas_capturadas' },
        () => carregar(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'eventos' },
        () => carregar(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitas' },
        () => carregar(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [equipeId, carregar])

  return { ...state, recarregar: carregar }
}
