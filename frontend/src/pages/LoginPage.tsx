import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { SimboloVisitare } from '../components/SimboloVisitare'

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
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="bg-primary text-on-primary px-6 pt-14 pb-8">
        <div className="flex items-center gap-3">
          <SimboloVisitare className="h-9 text-on-primary" />
          <h1 className="text-2xl font-bold">Visitare</h1>
        </div>
        <p className="text-on-primary/70 text-sm mt-2">Entrar como Agente Comunitário de Saúde</p>
        {DEMO_EMAIL && (
          <p className="text-on-primary/85 text-xs mt-3 bg-primary-dark/50 rounded-lg px-3 py-2">
            Modo demonstração — e-mail já preenchido. Digite a <strong>senha</strong> informada no evento e toque em <strong>Entrar</strong>.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="px-6 py-6 space-y-4 flex-1">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md bg-surface-container border border-surface-container-high px-3 py-2.5 text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md bg-surface-container border border-surface-container-high px-3 py-2.5 text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-error-container border border-error-strong/30 px-4 py-3 text-sm text-on-error-container">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary text-on-primary font-semibold py-3 active:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
