import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

function Brand() {
  return <Link to="/login" className="relative z-10 flex w-fit items-center gap-3" aria-label="Farol">
    <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white text-petroleo shadow-sm"><span className="h-2.5 w-2.5 rounded-full bg-current"/><span className="absolute h-6 w-3.5 translate-x-1.5 rounded-r-full border-r-[3px] border-current opacity-60"/></span>
    <span className="text-2xl font-extrabold tracking-tight text-white">Farol</span>
  </Link>
}

export default function AuthLayout({ children, cadastro = false }: { children: ReactNode; cadastro?: boolean }) {
  return <main className="min-h-screen bg-fundo lg:grid lg:grid-cols-[minmax(380px,0.9fr)_minmax(560px,1.1fr)]">
    <section className="relative hidden min-h-screen overflow-hidden bg-petroleo p-12 text-white lg:flex lg:flex-col xl:p-16">
      <Brand/>
      <div className="relative z-10 my-auto max-w-xl">
        <p className="mb-5 text-xs font-bold uppercase tracking-[.2em] text-white/55">Customer Success mais proativo</p>
        <h1 className="text-[clamp(2.6rem,4.1vw,4.5rem)] font-extrabold leading-[1.04] tracking-[-.04em]">{cadastro ? <>Comece a enxergar<br/>os sinais antes<br/>do cancelamento.</> : <>Veja quem precisa<br/>de atenção antes<br/>de decidir cancelar.</>}</h1>
        <p className="mt-7 max-w-lg text-lg leading-relaxed text-white/70">Risco de cancelamento, motivos e ações sugeridas de cada cliente, em um só painel.</p>
        <div className="mt-10 flex flex-wrap gap-3 text-xs font-semibold text-white/75"><span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">Risco explicado</span><span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">Ações priorizadas</span><span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">Visão da carteira</span></div>
      </div>
      <div aria-hidden="true" className="absolute -bottom-56 -right-56 h-[680px] w-[680px] rounded-full border-[38px] border-white/[.045]"/><div aria-hidden="true" className="absolute -bottom-24 right-2 h-[430px] w-[430px] rounded-full border-[24px] border-white/[.055]"/><div aria-hidden="true" className="absolute bottom-24 right-32 h-24 w-24 rounded-full bg-white/[.07]"/>
      <p className="relative z-10 text-sm text-white/50">Projeto acadêmico · dados fictícios</p>
    </section>
    <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
      <div className="w-full max-w-[520px]">
        <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-petroleo text-white">●</span><span className="text-2xl font-extrabold text-petroleo">Farol</span></div>
        {children}
      </div>
    </section>
  </main>
}

export function FieldIcon({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-suave"><svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg></span>
}

export const authInputClass = 'w-full border border-[#91a4aa] bg-white px-12 py-3.5 text-base text-texto shadow-[0_1px_2px_rgba(15,59,69,.03)] placeholder:text-[#94a1a6] hover:border-aco focus:border-aco focus:outline-none focus:ring-4 focus:ring-petroleo-claro'
