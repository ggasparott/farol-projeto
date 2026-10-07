import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ClienteDetalhe from './pages/ClienteDetalhe'
import Importar from './pages/Importar'
import Painel from './pages/Painel'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Painel />} />
          <Route path="importar" element={<Importar />} />
          <Route path="clientes/:id" element={<ClienteDetalhe />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
