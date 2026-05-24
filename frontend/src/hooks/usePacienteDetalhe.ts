import { useEffect, useState } from 'react'
import { fetchPacienteDetalhe } from '../lib/supabaseAdapter'
import type { Paciente } from '../types'

interface State {
  paciente: Paciente | null
  loading: boolean
  error: Error | null
}

export function usePacienteDetalhe(pacienteId: string | undefined) {
  const [state, setState] = useState<State>({
    paciente: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!pacienteId) {
      setState({ paciente: null, loading: false, error: null })
      return
    }
    let cancelled = false
    fetchPacienteDetalhe(pacienteId)
      .then((p) => {
        if (!cancelled) setState({ paciente: p, loading: false, error: null })
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ paciente: null, loading: false, error: e })
      })
    return () => {
      cancelled = true
    }
  }, [pacienteId])

  return state
}
