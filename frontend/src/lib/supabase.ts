import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes — ' +
      'a integração com Supabase não vai funcionar. Copie .env.example para .env.local.',
  )
}

export const supabase = createClient(url, anonKey, {
  // Login real: a sessão precisa persistir e renovar o token.
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 10 } },
})

// Claims customizados injetados no JWT pelo custom_access_token_hook (ver ADR 0002).
export interface AcsClaims {
  acs_id: string
  team_id: string
  role: string
}

// Decodifica o payload do access_token para ler os claims (acs_id/team_id/role).
export function readClaims(accessToken: string | undefined): AcsClaims | null {
  if (!accessToken) return null
  try {
    const payload = JSON.parse(
      atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    )
    if (!payload.acs_id) return null
    return { acs_id: payload.acs_id, team_id: payload.team_id, role: payload.role ?? 'acs' }
  } catch {
    return null
  }
}

// Data de referência: fim do dataset anonimizado (date-shifted).
export const REF_DATE = '2025-12-31'
