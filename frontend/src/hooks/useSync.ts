import { useState, useEffect, useCallback } from 'react'
import { getVisitasPendentes, marcarComoSynced } from '../db'
import type { SyncStatus } from '../types'

export function useSync() {
  const [pendentes, setPendentes] = useState(0)
  const [status, setStatus] = useState<SyncStatus>('synced')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const atualizarPendentes = useCallback(async () => {
    const lista = await getVisitasPendentes()
    setPendentes(lista.length)
    setStatus(lista.length > 0 ? 'pending' : 'synced')
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
  }, [])

  const sincronizar = useCallback(async () => {
    const lista = await getVisitasPendentes()
    if (lista.length === 0) return

    setStatus('syncing')
    try {
      // Chama API backend (mock por enquanto)
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registros: lista }),
      })

      if (res.ok) {
        const ids = lista.map((v) => v.id!).filter(Boolean)
        await marcarComoSynced(ids)
        setPendentes(0)
        setStatus('synced')
      } else {
        setStatus('error')
      }
    } catch {
      // offline ou backend indisponível — não é erro, é esperado
      setStatus('pending')
    }
  }, [])

  return { pendentes, status, isOnline, sincronizar, atualizarPendentes }
}
