import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ListaPage } from './pages/ListaPage'
import { VisitaPage } from './pages/VisitaPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen">
        <Routes>
          <Route path="/" element={<ListaPage />} />
          <Route path="/visita/:id" element={<VisitaPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
