import { useCallback, useEffect, useState } from 'react'
import { getVisitasPendentes, marcarComoSynced } from '../db'
import { supabase } from '../lib/supabase'
import type { RegistroVisita, SyncStatus } from '../types'

// Mapeia um RegistroVisita do IndexedDB para o schema da tabela
// `captured_visits` no Supabase. O form todo vai no jsonb `payload`,
// preservando a estrutura para auditoria e re-renderização posterior.
function toCapturada(v: RegistroVisita) {
  const profileBlocks: string[] = []
  if (v.tomaMedicacaoHipertensao !== undefined || v.valorPressao) profileBlocks.push('hipertenso')
  if (v.tomaMedicacaoDiabetes !== undefined || v.ultimaGlicemia) profileBlocks.push('diabetico')
  if (v.semanaGestacional !== undefined || v.preNatalEmDia !== undefined) profileBlocks.push('gestante')
  if (v.pesoCrianca || v.vacinasEmDia !== undefined) profileBlocks.push('crianca')
  if (v.situacaoRisco !== undefined) profileBlocks.push('vulneravel')
  if (profileBlocks.length === 0) profileBlocks.push('cadastro_familia')

  // O payload é todo o registro (menos campos meta).
  const { id: _id, synced: _synced, ...payload } = v

  return {
    patient_id: v.pacienteId,
    professional_id: v.profissionalId,
    profile_blocks: profileBlocks,
    payload,
  }
}

export function useSync() {
  const [pendentes, setPendentes] = useState(0)
  const [status, setStatus] = useState<SyncStatus>('synced')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const atualizarPendentes = useCallback(async () => {
    const lista = await getVisitasPendentes()
    setPendentes(lista.length)
    setStatus(lista.length > 0 ? 'pending' : 'synced')
  }, [])

  const sincronizar = useCallback(async () => {
    const lista = await getVisitasPendentes()
    if (lista.length === 0) return

    setStatus('syncing')
    try {
      const registros = lista.map(toCapturada)
      const { error } = await supabase.from('captured_visits').insert(registros)

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[useSync] erro do Supabase:', error)
        setStatus('error')
        return
      }

      const ids = lista.map((v) => v.id!).filter(Boolean)
      await marcarComoSynced(ids)
      setPendentes(0)
      setStatus('synced')
    } catch (e) {
      // offline ou backend indisponível — não é erro, é esperado
      // eslint-disable-next-line no-console
      console.warn('[useSync] sync adiada:', e)
      setStatus('pending')
    }
  }, [])

  useEffect(() => {
    atualizarPendentes()

    const onOnline = () => {
      setIsOnline(true)
      sincronizar()
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [atualizarPendentes, sincronizar])

  return { pendentes, status, isOnline, sincronizar, atualizarPendentes }
}
