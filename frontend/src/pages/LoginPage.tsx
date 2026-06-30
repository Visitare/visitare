import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Demo: só o e-mail é pré-preenchido (via env, gitignored). A senha NÃO —
// é dita ao vivo no evento e digitada pelos testers, então não vaza no bundle público.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL ?? ''

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message || 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-blue-700 text-white px-6 pt-14 pb-8">
        <h1 className="text-2xl font-bold">Visitare</h1>
        <p className="text-blue-200 text-sm mt-1">Entrar como Agente Comunitário de Saúde</p>
        {DEMO_EMAIL && (
          <p className="text-blue-100 text-xs mt-3 bg-blue-800/50 rounded-lg px-3 py-2">
            Modo demonstração — e-mail já preenchido. Digite a <strong>senha</strong> informada no evento e toque em <strong>Entrar</strong>.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="px-6 py-6 space-y-4 flex-1">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-700 text-white font-semibold py-3 active:bg-blue-800 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
