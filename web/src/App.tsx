import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Painel from './pages/Painel'
import ClienteDetalhe from './pages/ClienteDetalhe'
import Importar from './pages/Importar'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import ClienteCadastro from './pages/ClienteCadastro'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />

          {/* Rotas Protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Painel />} />
              <Route path="/clientes/novo" element={<ClienteCadastro />} />
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/importar" element={<Importar />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
