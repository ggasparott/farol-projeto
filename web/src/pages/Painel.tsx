import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import Aviso from '../components/Aviso'
import RiscoBadge from '../components/RiscoBadge'
import { usePainel } from '../hooks/usePainel'
import { fmtDataHora } from '../lib/risco'
import { supabase } from '../lib/supabase'
import type { NivelRisco } from '../types'

interface ResumoAtualizacao { processados: number; mudaram_nivel: number; restantes: number }
const FILTROS: { valor: NivelRisco | 'TODOS'; rotulo: string }[] = [{ valor: 'TODOS', rotulo: 'Todos' }, { valor: 'ALTO', rotulo: 'Alto' }, { valor: 'MEDIO', rotulo: 'Médio' }, { valor: 'BAIXO', rotulo: 'Baixo' }, { valor: 'SEM_SCORE', rotulo: 'Sem score' }]

export default function Painel() {
  const [filtro, setFiltro] = useState<NivelRisco | 'TODOS'>('TODOS'); const [atualizando, setAtualizando] = useState(false); const [resultado, setResultado] = useState<string | null>(null); const [erroAtualizacao, setErroAtualizacao] = useState<string | null>(null)
  const { linhas, todasLinhas, carregando, erro, recarregar } = usePainel(filtro)
  const contagem = (nivel: NivelRisco) => todasLinhas.filter((l) => l.nivel_risco === nivel).length
  const temClassificados = todasLinhas.some((linha) => linha.score !== null)
  const temSemScore = todasLinhas.some((linha) => linha.score === null)
  const cards = [{ titulo: 'Total de clientes', valor: todasLinhas.length, detalhe: 'na carteira', nivel: null }, { titulo: 'Risco alto', valor: contagem('ALTO'), detalhe: 'score acima de 0,70', nivel: 'ALTO' as NivelRisco }, { titulo: 'Risco médio', valor: contagem('MEDIO'), detalhe: 'score de 0,40 a 0,70', nivel: 'MEDIO' as NivelRisco }, { titulo: 'Risco baixo', valor: contagem('BAIXO'), detalhe: 'score abaixo de 0,40', nivel: 'BAIXO' as NivelRisco }, { titulo: 'Sem score', valor: contagem('SEM_SCORE'), detalhe: 'fora do ranking de risco', nivel: 'SEM_SCORE' as NivelRisco }]
  async function atualizarAnalises() {
    setAtualizando(true)
    setResultado(null)
    setErroAtualizacao(null)
    try {
      const { data, error } = await supabase.functions.invoke<ResumoAtualizacao>('classificar-risco')
      if (error) throw error
      if (!data) throw new Error('A atualização não retornou um resumo.')

      const mensagemRestantes = data.restantes > 0
        ? `${data.restantes} cliente(s) ainda aguardam análise. Clique em “Atualizar análise” novamente para continuar.`
        : ''
      setResultado(data.processados === 0
        ? mensagemRestantes || 'As análises já estão atualizadas.'
        : `${data.processados} cliente(s) atualizado(s); ${data.mudaram_nivel} mudaram de nível de risco.${mensagemRestantes ? ` ${mensagemRestantes}` : ''}`)
      recarregar()
    } catch (e) {
      setErroAtualizacao(e instanceof Error ? e.message : 'Não foi possível atualizar as análises.')
    } finally {
      setAtualizando(false)
    }
  }

  return <>
    <header className="mb-7 flex flex-wrap items-start justify-between gap-5"><div><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Painel de risco</h1><p className="mt-1 text-suave">Clientes classificados aparecem primeiro; os sem score ficam fora do ranking de risco.</p></div><button onClick={atualizarAnalises} disabled={atualizando} className="rounded-xl border border-aco bg-white px-5 py-3 text-sm font-bold text-aco hover:bg-petroleo-claro disabled:opacity-50">↻&nbsp; {atualizando ? 'Atualizando…' : 'Atualizar análise'}</button></header>
    {resultado && <div className="mb-5"><Aviso>{resultado}</Aviso></div>}{erroAtualizacao && <div className="mb-5"><Aviso tipo="erro">{erroAtualizacao}</Aviso></div>}
    <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map((card) => <div key={card.titulo} className="card p-5"><div className="mb-4">{card.nivel ? <RiscoBadge nivel={card.nivel}/> : <span className="text-sm font-bold text-suave">▦&nbsp; {card.titulo}</span>}</div><strong className="block text-4xl font-extrabold tabular-nums">{card.valor}</strong><span className="mt-2 block text-sm text-suave">{card.detalhe}</span></div>)}</section>
    <section className="card mb-6 flex flex-wrap items-center gap-3 p-4"><span className="mr-2 text-sm font-bold text-suave">Nível de risco</span>{FILTROS.map((f) => <button key={f.valor} onClick={() => setFiltro(f.valor)} className={`rounded-full border px-4 py-2 text-sm font-bold ${filtro === f.valor ? 'border-aco bg-aco text-white' : 'border-[#9babb0] bg-white text-texto hover:border-aco'}`}>{f.rotulo}</button>)}<span className="ml-auto text-sm text-suave">Mostrando {linhas.length} cliente(s)</span></section>
    {erro && <Aviso tipo="erro">Erro ao carregar o painel: {erro}</Aviso>}{carregando && <Aviso>Carregando…</Aviso>}
    {!carregando && !erro && linhas.length === 0 && <div className="card px-6 py-20 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-petroleo-claro text-4xl text-aco">◉</div><h2 className="text-2xl font-extrabold">{todasLinhas.length === 0 ? 'Ainda não há clientes ativos' : `Nenhum cliente no filtro “${FILTROS.find((f) => f.valor === filtro)?.rotulo}”`}</h2><p className="mx-auto mt-2 max-w-xl text-suave">{todasLinhas.length === 0 ? 'Cadastre um cliente ou importe clientes por CSV para começar.' : 'Os cartões acima continuam mostrando os totais de toda a carteira ativa.'}</p>{todasLinhas.length === 0 && <Link to="/clientes/novo" className="mt-6 inline-block rounded-xl bg-aco px-5 py-3 font-bold text-white">Cadastrar ou importar clientes</Link>}</div>}
    {linhas.length > 0 && <div className="card overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="bg-petroleo-claro/55 text-suave">{['Cliente', 'Segmento', 'Score', 'Nível de risco', 'NPS', 'Última análise', ''].map((h) => <th key={h} className="px-5 py-4 font-bold">{h}</th>)}</tr></thead><tbody>{filtro === 'TODOS' && !temClassificados && temSemScore && <tr><td colSpan={7} className="border-t-2 border-linha bg-petroleo-claro/35 px-5 py-3 text-xs font-bold uppercase tracking-wider text-suave">Sem score · fora do ranking de risco</td></tr>}{linhas.map((l, indice) => { const nps = [...l.cliente.avaliacao_nps].sort((a,b) => b.data_coleta.localeCompare(a.data_coleta))[0]; const inicioSemScore = filtro === 'TODOS' && l.score === null && indice > 0 && temClassificados && linhas[indice - 1].score !== null; return <Fragment key={`${l.cliente.id}-${l.id}`}>{inicioSemScore && <tr><td colSpan={7} className="border-t-2 border-linha bg-petroleo-claro/35 px-5 py-3 text-xs font-bold uppercase tracking-wider text-suave">Sem score · fora do ranking de risco</td></tr>}<tr className="border-t border-linha hover:bg-petroleo-claro/25"><td className="px-5 py-4"><Link to={`/clientes/${l.cliente.id}`} className="font-bold text-texto hover:text-aco">{l.cliente.razao_social}</Link></td><td className="px-5 py-4 text-suave">{l.cliente.segmento}</td><td className="px-5 py-4">{l.score === null ? <span className="text-suave">—</span> : <><span className="font-extrabold tabular-nums">{l.score.toFixed(2)}</span><div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-linha"><div className="h-full rounded-full bg-aco" style={{width: `${l.score * 100}%`}}/></div></>}</td><td className="px-5 py-4"><RiscoBadge nivel={l.nivel_risco}/></td><td className="px-5 py-4 tabular-nums">{nps?.nota ?? '—'}</td><td className="px-5 py-4 text-suave">{l.executada_em ? fmtDataHora(l.executada_em) : '—'}</td><td className="px-5 py-4 text-xl text-aco">›</td></tr></Fragment>})}</tbody></table></div>}
  </>
}
