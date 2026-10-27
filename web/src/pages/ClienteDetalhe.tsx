import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import Aviso from '../components/Aviso'
import RiscoBadge from '../components/RiscoBadge'
import { useCliente } from '../hooks/useCliente'
import { supabase } from '../lib/supabase'
import type { AcaoAplicada } from '../types'
import { fmtData, fmtDataHora, ORDEM, pct } from '../lib/risco'

function Card({ titulo, descricao, children, className = '' }: { titulo: string; descricao?: string; children: ReactNode; className?: string }) {
  return <section className={`card p-5 sm:p-6 ${className}`}><div className="mb-5"><h2 className="text-xl font-extrabold tracking-tight">{titulo}</h2>{descricao && <p className="mt-1 text-sm text-suave">{descricao}</p>}</div>{children}</section>
}

function Info({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return <div><dt className="text-xs font-semibold text-suave">{rotulo}</dt><dd className="mt-1 text-sm font-bold text-texto">{valor}</dd></div>
}

const numero = new Intl.NumberFormat('pt-BR')
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ClienteDetalhe() {
  const id = Number(useParams().id)
  const { dados, carregando, erro } = useCliente(id)
  const [registradas, setRegistradas] = useState<AcaoAplicada[]>([])
  const [registrando, setRegistrando] = useState<number[]>([])
  const [comentarios, setComentarios] = useState<Record<number, string>>({})
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [aba, setAba] = useState<'visao' | 'dados' | 'acoes'>('visao')

  if (carregando) return <Aviso>Carregando detalhes do cliente…</Aviso>
  if (erro) return <Aviso tipo="erro">Erro ao carregar o cliente: {erro}</Aviso>
  if (!dados) return <Aviso>Cliente não encontrado. <Link to="/" className="font-bold text-aco underline">Voltar ao painel</Link></Aviso>

  const { cliente, analise, uso, atendimentos, nps, acoes } = dados
  const registrosAcao = new Map<number, AcaoAplicada[]>()
  for (const registro of [...dados.acoesRegistradas, ...registradas]) {
    registrosAcao.set(registro.acao_id, [...(registrosAcao.get(registro.acao_id) ?? []), registro])
  }
  const fatores = [...(analise?.fator_risco ?? [])].sort((a, b) => b.contribuicao - a.contribuicao)
  const nivel = analise?.nivel_risco ?? 'SEM_SCORE'
  const codigos = new Set(fatores.map((f) => f.fator_codigo))
  const sugestoes = acoes.filter((a) => registrosAcao.has(a.id) || (codigos.has(a.fator_codigo) && ORDEM[a.nivel_minimo] <= ORDEM[nivel])).sort((a, b) => b.peso_prioridade - a.peso_prioridade)
  const ultimoUso = uso[0]
  const ultimoNps = nps[0]
  const ticketsCriticos = atendimentos.filter((item) => ['ALTA', 'CRITICA'].includes(item.criticidade)).length

  async function registrar(acaoId: number, prioridade: number, comentario = comentarios[acaoId] ?? '') {
    setErroAcao(null); setRegistrando((ids) => [...ids, acaoId])
    try {
      const { data, error } = await supabase.from('acao_aplicada').insert({ cliente_id: id, acao_id: acaoId, analise_id: analise?.id ?? null, status: 'PLANEJADA', prioridade, sugerida_em: new Date().toISOString(), observacao: comentario.trim() || null }).select('id, acao_id, sugerida_em, observacao').single()
      if (error) setErroAcao(error.message)
      else { setRegistradas((itens) => [...itens, data as AcaoAplicada]); setComentarios((valores) => ({ ...valores, [acaoId]: '' })) }
    } catch (e) { setErroAcao(e instanceof Error ? e.message : 'Não foi possível registrar a ação.') }
    finally { setRegistrando((ids) => ids.filter((registroId) => registroId !== acaoId)) }
  }

  return <>
    <nav className="mb-4 flex items-center gap-2 text-sm"><Link to="/" className="font-bold text-aco hover:underline">Painel</Link><span className="text-suave">/</span><span className="truncate text-suave">{cliente.razao_social}</span></nav>

    <section className="card mb-4 overflow-hidden">
      <div className="grid lg:grid-cols-[1fr_360px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="rotulo mb-2">Detalhes do cliente</p><h1 className="max-w-4xl text-3xl font-extrabold tracking-[-.03em] sm:text-4xl">{cliente.razao_social}</h1><p className="mt-2 text-suave">{cliente.cnpj || 'CNPJ não informado'}</p></div><span className="rounded-full bg-petroleo-claro px-3 py-1.5 text-xs font-bold text-aco">{cliente.status}</span></div>
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4"><Info rotulo="Segmento" valor={cliente.segmento}/><Info rotulo="Plano" valor={cliente.plano}/><Info rotulo="Cliente desde" valor={fmtData(cliente.data_inicio_contrato)}/><Info rotulo="Valor mensal" valor={cliente.valor_mensal === null ? 'Não informado' : moeda.format(cliente.valor_mensal)}/></dl>
        </div>
        <div className="border-t border-linha bg-petroleo-claro/35 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="text-sm font-bold text-suave">Risco de cancelamento</p>
          {analise?.score !== null && analise ? <><div className="mt-3 flex items-end gap-3"><strong className="text-5xl font-extrabold tabular-nums tracking-tight">{analise.score.toFixed(2)}</strong><span className="mb-1.5 text-xl font-bold text-suave">{Math.round(analise.score * 100)}%</span></div><div className="mt-3"><RiscoBadge nivel={nivel}/></div><p className="mt-4 text-xs leading-relaxed text-suave">Calculado em {fmtDataHora(analise.executada_em)}.</p></> : <><div className="mt-4"><RiscoBadge nivel="SEM_SCORE"/></div><p className="mt-4 text-sm text-suave">Ainda não há dados suficientes para calcular o risco.</p></>}
        </div>
      </div>
    </section>

    <section className="mb-4 grid gap-3 sm:grid-cols-3">
      <div className="card px-5 py-4"><p className="text-xs font-bold text-suave">Acessos no último mês</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-2xl font-extrabold">{ultimoUso ? numero.format(ultimoUso.qtd_acessos) : '—'}</strong><span className="text-xs text-suave">{ultimoUso ? `${numero.format(ultimoUso.qtd_usuarios_ativos)} usuários ativos` : 'Sem dados'}</span></div></div>
      <div className="card px-5 py-4"><p className="text-xs font-bold text-suave">Último NPS</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-2xl font-extrabold">{ultimoNps?.nota ?? '—'}</strong><span className="text-xs text-suave">{ultimoNps ? fmtData(ultimoNps.data_coleta) : 'Sem avaliações'}</span></div></div>
      <div className="card px-5 py-4"><p className="text-xs font-bold text-suave">Tickets críticos</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-2xl font-extrabold">{ticketsCriticos}</strong><span className="text-xs text-suave">em {atendimentos.length} recentes</span></div></div>
    </section>

    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-linha bg-white p-1.5" role="tablist" aria-label="Seções do cliente">
      {([
        ['visao', 'Visão geral'],
        ['dados', 'Dados e histórico'],
        ['acoes', `Ações de retenção${sugestoes.length ? ` (${sugestoes.length})` : ''}`],
      ] as const).map(([valor, rotulo]) => <button key={valor} type="button" role="tab" aria-selected={aba === valor} onClick={() => setAba(valor)} className={`whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-bold ${aba === valor ? 'bg-petroleo text-white shadow-sm' : 'text-suave hover:bg-petroleo-claro hover:text-aco'}`}>{rotulo}</button>)}
    </div>

    <div className={`grid gap-6 ${aba === 'visao' ? 'xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]' : 'grid-cols-1'}`}>
      <div className={`space-y-6 ${aba === 'acoes' ? 'hidden' : ''}`}>
        <Card className={aba !== 'visao' ? 'hidden' : ''} titulo="Por que este risco" descricao="Fatores que mais contribuíram para a classificação atual, do maior para o menor impacto.">
          {fatores.length === 0 ? <p className="text-sm text-suave">Nenhum fator disponível para esta análise.</p> : <ol className="space-y-5">{fatores.map((f, indice) => <li key={f.fator_codigo} className="grid grid-cols-[36px_1fr] gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-petroleo-claro text-sm font-extrabold text-aco">{indice + 1}</span><div><div className="flex items-center justify-between gap-4"><p className="font-bold">{f.fator.nome}</p><strong className="text-sm tabular-nums text-aco">{pct(f.contribuicao)}</strong></div><p className="mt-1 text-sm text-suave">{f.fator.descricao}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-linha"><div className="h-full rounded-full bg-petroleo-medio" style={{ width: pct(f.contribuicao) }}/></div></div></li>)}</ol>}
        </Card>

        <Card className={aba !== 'dados' ? 'hidden' : ''} titulo="Histórico de uso" descricao="Últimos meses de utilização registrados para o cliente.">
          {uso.length === 0 ? <p className="text-sm text-suave">Sem dados de uso disponíveis.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="text-suave"><th className="pb-3 font-bold">Mês</th><th className="pb-3 font-bold">Acessos</th><th className="pb-3 font-bold">Minutos</th><th className="pb-3 font-bold">Usuários ativos</th></tr></thead><tbody>{uso.map((u) => <tr key={u.competencia} className="border-t border-linha"><td className="py-3 font-bold">{u.competencia.slice(0, 7)}</td><td className="py-3 tabular-nums">{numero.format(u.qtd_acessos)}</td><td className="py-3 tabular-nums">{numero.format(u.minutos_uso)}</td><td className="py-3 tabular-nums">{numero.format(u.qtd_usuarios_ativos)}</td></tr>)}</tbody></table></div>}
        </Card>

        <Card className={aba !== 'dados' ? 'hidden' : ''} titulo="Atendimentos recentes" descricao="Tickets que ajudam a contextualizar o relacionamento com o cliente.">
          {atendimentos.length === 0 ? <p className="text-sm text-suave">Sem atendimentos registrados.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="text-suave"><th className="pb-3 font-bold">Protocolo</th><th className="pb-3 font-bold">Assunto</th><th className="pb-3 font-bold">Criticidade</th><th className="pb-3 font-bold">Status</th><th className="pb-3 text-right font-bold">Resposta</th></tr></thead><tbody>{atendimentos.map((item) => <tr key={item.id} className="border-t border-linha"><td className="py-3 font-bold">{item.protocolo}</td><td className="max-w-xs py-3 text-suave">{item.assunto ?? '—'}</td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${['ALTA','CRITICA'].includes(item.criticidade) ? 'bg-[#fff0ec] text-risco-alto' : 'bg-petroleo-claro text-aco'}`}>{item.criticidade}</span></td><td className="py-3 text-suave">{item.status.replace('_', ' ')}</td><td className="py-3 text-right tabular-nums">{item.tempo_resposta_horas === null ? '—' : `${item.tempo_resposta_horas} h`}</td></tr>)}</tbody></table></div>}
        </Card>
      </div>

      <div className={`space-y-6 ${aba === 'dados' ? 'hidden' : ''}`}>
        <Card className={aba !== 'acoes' ? 'hidden' : 'mx-auto w-full max-w-5xl'} titulo="Ações de retenção" descricao="Sugestões ligadas aos fatores de risco identificados.">
          {nivel === 'BAIXO' && <Aviso>Risco baixo: nenhuma ação prioritária no momento.</Aviso>}
          {nivel === 'SEM_SCORE' && <Aviso>Importe mais dados para gerar sugestões de retenção.</Aviso>}
          {(nivel === 'MEDIO' || nivel === 'ALTO') && sugestoes.length === 0 && <Aviso>Nenhuma regra específica foi encontrada. Considere realizar um contato ativo.</Aviso>}
          <div className="space-y-4">{sugestoes.map((acao, indice) => {
            const historico = (registrosAcao.get(acao.id) ?? []).sort((a, b) => b.sugerida_em.localeCompare(a.sugerida_em)); const registrada = historico.length > 0; const ocupado = registrando.includes(acao.id)
            return <article key={acao.id} className="rounded-xl border border-linha p-4"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-petroleo-claro text-sm font-extrabold text-aco">{indice + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{acao.nome}</h3>{registrada && <span className="rounded-full bg-[#eaf8f0] px-2 py-1 text-[.68rem] font-bold text-risco-baixo">PLANEJADA</span>}</div><p className="mt-1 text-sm leading-relaxed text-suave">{acao.descricao}</p></div></div>
              {historico.length > 0 && <div className="mt-4 space-y-2 border-l-2 border-petroleo-claro pl-3">{historico.map((registro) => <div key={registro.id} className="text-xs text-suave"><p className="font-semibold">{fmtDataHora(registro.sugerida_em)}</p>{registro.observacao && <p className="mt-1">{registro.observacao}</p>}</div>)}</div>}
              <label className="mt-4 block text-xs font-bold text-suave">{registrada ? 'Adicionar acompanhamento' : 'Observação opcional'}<textarea rows={2} value={comentarios[acao.id] ?? ''} onChange={(e) => setComentarios((valores) => ({ ...valores, [acao.id]: e.target.value }))} className="mt-1.5 block w-full resize-none border border-linha bg-white p-3 text-sm font-normal text-texto focus:border-aco focus:outline-none" placeholder="Registre o próximo passo ou contexto da ação"/></label>
              <button disabled={ocupado || (registrada && !(comentarios[acao.id] ?? '').trim())} onClick={() => registrar(acao.id, acao.peso_prioridade)} className="mt-3 w-full rounded-lg bg-aco px-4 py-2.5 text-sm font-bold text-white hover:bg-petroleo disabled:bg-linha disabled:text-suave">{ocupado ? 'Registrando…' : registrada ? 'Registrar acompanhamento' : 'Planejar esta ação'}</button>
            </article>
          })}</div>
          {erroAcao && <div className="mt-4"><Aviso tipo="erro">{erroAcao}</Aviso></div>}
        </Card>

        <Card className={aba !== 'visao' ? 'hidden' : ''} titulo="Últimas notas de NPS" descricao="Evolução recente da percepção do cliente.">
          {nps.length === 0 ? <p className="text-sm text-suave">Sem avaliações de NPS.</p> : <ul className="space-y-3">{nps.map((item) => { const classe = item.nota <= 6 ? 'text-risco-alto bg-[#fff0ec]' : item.nota <= 8 ? 'text-risco-medio bg-[#fff6dc]' : 'text-risco-baixo bg-[#eaf8f0]'; const faixa = item.nota <= 6 ? 'Detrator' : item.nota <= 8 ? 'Neutro' : 'Promotor'; return <li key={item.data_coleta} className="flex items-center gap-3 border-b border-linha pb-3 last:border-0 last:pb-0"><strong className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${classe}`}>{item.nota}</strong><div><p className="text-sm font-bold">{faixa}</p><p className="text-xs text-suave">{fmtData(item.data_coleta)}</p></div></li>})}</ul>}
        </Card>
      </div>
    </div>
  </>
}
