import { useState } from 'react'
import { Link } from 'react-router-dom'
import Aviso from '../components/Aviso'
import RiscoBadge from '../components/RiscoBadge'
import { usePainel } from '../hooks/usePainel'
import { fmtDataHora } from '../lib/risco'
import type { NivelRisco } from '../types'

const FILTROS: { valor: NivelRisco | 'TODOS'; rotulo: string }[] = [
  { valor: 'TODOS', rotulo: 'Todos' },
  { valor: 'ALTO', rotulo: 'Alto' },
  { valor: 'MEDIO', rotulo: 'Médio' },
  { valor: 'BAIXO', rotulo: 'Baixo' },
]

export default function Painel() {
  const [filtro, setFiltro] = useState<NivelRisco | 'TODOS'>('TODOS')
  const { linhas, carregando, erro } = usePainel(filtro)

  return (
    <>
      <p className="rotulo">UC08 · Painel de Customer Success</p>
      <h1 className="mb-6 text-2xl font-bold uppercase">Clientes em risco</h1>

      <div className="mb-4 flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              filtro === f.valor ? 'border-aco bg-aco text-white' : 'border-linha bg-white text-suave hover:border-aco'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {erro && <Aviso tipo="erro">Erro ao carregar o painel: {erro}</Aviso>}
      {carregando && <Aviso>Carregando…</Aviso>}

      {!carregando && !erro && linhas.length === 0 && (
        <Aviso>
          {filtro === 'TODOS' ? (
            <>Nenhuma análise executada. <Link to="/importar" className="font-bold text-aco underline">Importe os dados</Link> e execute a análise de risco.</>
          ) : (
            'Nenhum cliente neste nível de risco.'
          )}
        </Aviso>
      )}

      {linhas.length > 0 && (
        <table className="w-full border border-linha bg-white text-left text-sm">
          <thead className="border-b border-linha">
            <tr className="rotulo">
              {['Cliente', 'Segmento', 'Nível', 'Score', 'NPS', 'Última análise'].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const nps = [...l.cliente.avaliacao_nps].sort((a, b) => b.data_coleta.localeCompare(a.data_coleta))[0]
              return (
                <tr key={l.id} className="border-b border-linha last:border-0 hover:bg-aco-claro">
                  <td className="px-4 py-3">
                    <Link to={`/clientes/${l.cliente.id}`} className="font-bold text-aco hover:underline">
                      {l.cliente.razao_social}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-suave">{l.cliente.segmento}</td>
                  <td className="px-4 py-3"><RiscoBadge nivel={l.nivel_risco} /></td>
                  <td className="px-4 py-3 tabular-nums">{l.score.toFixed(2)}</td>
                  <td className="px-4 py-3 tabular-nums">{nps ? nps.nota : '—'}</td>
                  <td className="px-4 py-3 text-suave">{fmtDataHora(l.executada_em)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
