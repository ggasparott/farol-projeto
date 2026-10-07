import type { ReactNode } from 'react'

export default function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'erro'; children: ReactNode }) {
  const cor = tipo === 'erro' ? 'border-risco-alto text-risco-alto' : 'border-linha text-suave'
  return <div className={`border bg-white p-4 text-sm ${cor}`}>{children}</div>
}
