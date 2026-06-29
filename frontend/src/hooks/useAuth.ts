// Identidade do ACS na sessão — vem do Supabase Auth (JWT com claims
// acs_id/team_id/role, injetados pelo custom_access_token_hook). Em produção,
// o login federa com o IdP da prefeitura (ADR 0002) sem mudar este hook.
import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { readClaims, supabase, type AcsClaims } from '../lib/supabase'

interface AuthState {
  session: Session | null
  claims: AcsClaims | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ session: null, claims: null, loading: true })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setState({
        session: data.session,
        claims: readClaims(data.session?.access_token),
        loading: false,
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, claims: readClaims(session?.access_token), loading: false })
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return {
    session: state.session,
    acsId: state.claims?.acs_id ?? null,
    teamId: state.claims?.team_id ?? null,
    role: state.claims?.role ?? null,
    loading: state.loading,
    signIn,
    signOut,
  }
}
