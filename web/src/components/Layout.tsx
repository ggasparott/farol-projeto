import { Link, NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)

function Logo() {
  return <Link to="/" className="flex items-center gap-3 text-white" aria-label="Farol - início"><span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white text-petroleo"><span className="h-2.5 w-2.5 rounded-full bg-current" /><span className="absolute h-5 w-3 translate-x-1.5 rounded-r-full border-r-[3px] border-current opacity-70" /></span><span className="text-[1.35rem] font-extrabold tracking-tight">Farol</span></Link>
}

export default function Layout() {
  const { usuarioPerfil, user, logout } = useAuth()
  const nome = usuarioPerfil?.nome || user?.email || 'Analista de CS'
  const iniciais = nome.split(/\s+/).slice(0, 2).map((parte: string) => parte[0]).join('').toUpperCase()
  const navClass = ({ isActive }: { isActive: boolean }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`

  return <div className="min-h-screen bg-fundo text-texto lg:flex">
    <aside className="flex bg-petroleo px-5 py-5 lg:fixed lg:inset-y-0 lg:w-64 lg:flex-col lg:px-4 lg:py-6">
      <div className="lg:px-2"><Logo /></div>
      <nav className="ml-auto flex gap-1 lg:ml-0 lg:mt-10 lg:flex-col">
        <NavLink to="/" end className={navClass}><Icon><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></Icon><span className="hidden sm:inline">Painel</span></NavLink>
        <NavLink to="/importar" className={navClass}><Icon><path d="M12 16V4M8 8l4-4 4 4M5 20h14"/></Icon><span className="hidden sm:inline">Importação</span></NavLink>
        <NavLink to="/clientes/novo" className={navClass}><Icon><path d="M6 21V5a2 2 0 012-2h6a2 2 0 012 2v16M9 7h3M9 11h3M9 15h3M3 21h18"/></Icon><span className="hidden sm:inline">Clientes</span></NavLink>
      </nav>
      <div className="mt-auto hidden border-t border-white/15 pt-5 lg:block">
        <div className="mb-5 flex items-center gap-3 px-2"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">{iniciais}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{nome}</p><p className="text-xs text-white/60">Analista de CS</p></div></div>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"><Icon><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5"/></Icon>Sair</button>
      </div>
    </aside>
    <main className="min-w-0 flex-1 lg:ml-64"><div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-9"><Outlet /></div></main>
  </div>
}
