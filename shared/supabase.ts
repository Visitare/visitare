// Cliente Supabase compartilhado entre PWA (Vite) e Expo.
// Cada plataforma injeta as variáveis de ambiente de forma diferente:
//   - Vite (PWA):  import.meta.env.VITE_SUPABASE_*
//   - Expo:        process.env.EXPO_PUBLIC_SUPABASE_*
// Esta função aceita os valores já resolvidos para não depender do bundler.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from './constants'

let _client: SupabaseClient | null = null

export function getSupabaseClient(anonKey: string): SupabaseClient {
  if (_client) return _client
  _client = createClient(SUPABASE_URL, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  return _client
}

// Atalho: inicializa uma vez e reutiliza.
// Chame initSupabase() no bootstrap do app (App.tsx / _layout.tsx).
export function initSupabase(anonKey: string): SupabaseClient {
  return getSupabaseClient(anonKey)
}

export function supabaseClient(): SupabaseClient {
  if (!_client) throw new Error('Supabase não inicializado. Chame initSupabase(anonKey) primeiro.')
  return _client
}
