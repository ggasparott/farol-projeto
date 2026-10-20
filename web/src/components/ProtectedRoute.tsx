import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Aviso from './Aviso'

export default function ProtectedRoute() {
  const { session, carregando } = useAuth()

  if (carregando) {
    return <div className="p-8"><Aviso>Carregando sessão...</Aviso></div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}