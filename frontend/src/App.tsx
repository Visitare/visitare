import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { ListaPage } from './pages/ListaPage'
import { PacientePage } from './pages/PacientePage'
import { VisitaPage } from './pages/VisitaPage'
import { SupervisorPage } from './pages/SupervisorPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Carregando…
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><ListaPage /></RequireAuth>} />
          <Route path="/paciente/:id" element={<RequireAuth><PacientePage /></RequireAuth>} />
          <Route path="/visita/:id" element={<RequireAuth><VisitaPage /></RequireAuth>} />
          <Route path="/supervisor" element={<RequireAuth><SupervisorPage /></RequireAuth>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
