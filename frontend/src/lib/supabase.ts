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
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
})

// Demo: equipe pré-selecionada com variedade clínica (gestantes + crônicos).
// Em produção, vem do JWT do ACS (claim equipe_id).
export const DEMO_EQUIPE_ID =
  '0206636a6ea8f41ca0160ee7655cacacf2a83bfd5974400d8be1a691ba293c87'

// Data de referência: fim do dataset anonimizado (date-shifted).
export const REF_DATE = '2025-12-31'
