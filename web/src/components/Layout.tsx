import { NavLink, Outlet } from 'react-router-dom'

const link = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 text-xs font-bold uppercase tracking-widest ${isActive ? 'text-white border-b-2 border-white' : 'text-slate-300 hover:text-white'}`

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="bg-marinho">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="text-lg font-bold tracking-widest text-white">FAROL</span>
          <nav className="flex gap-2">
            <NavLink to="/" end className={link}>Painel</NavLink>
            <NavLink to="/importar" className={link}>Importar</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
