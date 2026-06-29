import { useCallback, useEffect, useState } from 'react'
import type { Paciente } from '../types'
import { REF_DATE, supabase } from '../lib/supabase'
import { distribuirSemana, fetchAcsWeekList } from '../lib/supabaseAdapter'

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

export function usePacientesSemana(acsId: string | null) {
  const [state, setState] = useState<State>({ ...EMPTY, loading: !!acsId })

  const carregar = useCallback(async () => {
    if (!acsId) {
      setState(EMPTY)
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const pacientes = await fetchAcsWeekList(acsId, REF_DATE)
      setState({
        semana: distribuirSemana(pacientes),
        pacientes,
        loading: false,
        error: null,
      })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e as Error }))
    }
  }, [acsId])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!acsId) return
    const channel = supabase
      .channel(`acs-${acsId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'captured_visits' },
        () => carregar(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'allocations' },
        () => carregar(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [acsId, carregar])

  return { ...state, recarregar: carregar }
}
