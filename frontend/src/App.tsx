import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ListaPage } from './pages/ListaPage'
import { PacientePage } from './pages/PacientePage'
import { VisitaPage } from './pages/VisitaPage'
import { SupervisorPage } from './pages/SupervisorPage'
import { SelecionarAcsPage } from './pages/SelecionarAcsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen">
        <Routes>
          <Route path="/" element={<ListaPage />} />
          <Route path="/selecionar-acs" element={<SelecionarAcsPage />} />
          <Route path="/paciente/:id" element={<PacientePage />} />
          <Route path="/visita/:id" element={<VisitaPage />} />
          <Route path="/supervisor" element={<SupervisorPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
