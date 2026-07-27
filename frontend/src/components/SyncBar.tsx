import type { SyncStatus } from '../types'

interface Props {
  pendentes: number
  status: SyncStatus
  isOnline: boolean
  onSync: () => void
}

export function SyncBar({ pendentes, status, isOnline, onSync }: Props) {
  if (status === 'synced' && isOnline) return null

  const bgColor = !isOnline
    ? 'bg-on-surface'
    : status === 'error'
      ? 'bg-error'
      : status === 'syncing'
        ? 'bg-primary'
        : 'bg-warning-strong'

  const label = !isOnline
    ? `Sem conexão — ${pendentes} registro${pendentes !== 1 ? 's' : ''} salvo${pendentes !== 1 ? 's' : ''} offline`
    : status === 'syncing'
      ? 'Enviando dados...'
      : status === 'error'
        ? 'Erro ao enviar — toque para tentar novamente'
        : `${pendentes} registro${pendentes !== 1 ? 's' : ''} pendente${pendentes !== 1 ? 's' : ''} — toque para enviar`

  return (
    <button
      onClick={onSync}
      disabled={!isOnline || status === 'syncing'}
      className={`w-full py-2 px-4 text-sm font-medium text-on-primary flex items-center justify-center gap-2 ${bgColor} disabled:opacity-70`}
    >
      {status === 'syncing' ? (
        <span className="animate-spin text-base">⟳</span>
      ) : !isOnline ? (
        <span>📵</span>
      ) : (
        <span>☁️</span>
      )}
      {label}
    </button>
  )
}
