import type { ReactNode } from 'react'
export default function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'erro'; children: ReactNode }) { const cor = tipo === 'erro' ? 'border-[#efb6aa] bg-[#fff0ec] text-risco-alto' : 'border-petroleo-claro bg-petroleo-claro/60 text-petroleo'; return <div className={`rounded-xl border p-4 text-sm ${cor}`}>{children}</div> }
