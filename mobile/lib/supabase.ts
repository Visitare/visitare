import { initSupabase, supabaseClient } from '../../shared/supabase'

const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!anonKey) {
  console.warn('[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY ausente — copie .env.example para .env.local')
}

initSupabase(anonKey)

export const supabase = supabaseClient
export { supabaseClient as db }
