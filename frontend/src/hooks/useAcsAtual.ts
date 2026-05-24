// Identidade da ACS na sessão.
// MVP: armazenado em localStorage; em produção virá do JWT do ConecteSUS.
// Resolve `equipe_id` a partir do `profissional_id` via RPC do Supabase.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'acs_profissional_id'

export function useAcsAtual() {
  const [profissionalId, setProfissionalIdState] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
  )
  const [equipeId, setEquipeId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(!!profissionalId)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!profissionalId) {
      setEquipeId(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .rpc('equipe_do_profissional', { p_profissional_id: profissionalId })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err as unknown as Error)
          setEquipeId(null)
        } else {
          setEquipeId((data as unknown as string) ?? null)
          setError(null)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profissionalId])

  const setAcs = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setProfissionalIdState(id)
  }, [])

  const limpar = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setProfissionalIdState(null)
    setEquipeId(null)
  }, [])

  return { profissionalId, equipeId, loading, error, setAcs, limpar }
}
