import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { usuarioPerfil, user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-fundo text-texto">
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-bold tracking-wider uppercase text-aco">
            Farol <span className="font-normal text-suave">CS</span>
          </Link>

          <nav className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider">
            <Link to="/" className="hover:text-aco">Painel</Link>
            <Link to="/importar" className="hover:text-aco">Importar</Link>

            <div className="flex items-center gap-3 border-l border-linha pl-6">
              <span className="text-suave">
                {usuarioPerfil?.nome || user?.email}
              </span>
              <button
                onClick={logout}
                className="text-red-600 hover:underline"
              >
                Sair
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  )
}