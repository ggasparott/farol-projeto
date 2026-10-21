import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import Aviso from '../components/Aviso'
import RiscoBadge from '../components/RiscoBadge'
import { useCliente } from '../hooks/useCliente'
import { supabase } from '../lib/supabase'
import type { AcaoAplicada } from '../types'
import { fmtData, fmtDataHora, ORDEM, pct } from '../lib/risco'

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border border-linha bg-white p-5">
      <h2 className="rotulo mb-3">{titulo}</h2>
      {children}
    </section>
  )
}

export default function ClienteDetalhe() {
  const id = Number(useParams().id)
  const { dados, carregando, erro } = useCliente(id)
  const [registradas, setRegistradas] = useState<AcaoAplicada[]>([])
  const [registrando, setRegistrando] = useState<number[]>([])
  const [comentarios, setComentarios] = useState<Record<number, string>>({})
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  if (carregando) return <Aviso>Carregando…</Aviso>
  if (erro) return <Aviso tipo="erro">Erro: {erro}</Aviso>
  if (!dados) {
    return <Aviso>Cliente não encontrado. <Link to="/" className="font-bold text-aco underline">Voltar ao painel</Link></Aviso>
  }

  const { cliente, analise, uso, atendimentos, nps, acoes } = dados
  const registrosAcao = new Map<number, AcaoAplicada[]>()
  for (const registro of [...dados.acoesRegistradas, ...registradas]) {
    const historico = registrosAcao.get(registro.acao_id) ?? []
    registrosAcao.set(registro.acao_id, [...historico, registro])
  }
  const fatores = [...(analise?.fator_risco ?? [])].sort((a, b) => b.contribuicao - a.contribuicao)
  const nivel = analise?.nivel_risco ?? 'SEM_SCORE'
  const codigos = new Set(fatores.map((f) => f.fator_codigo))

  // UC10: acoes ligadas aos fatores predominantes cujo nivel minimo o cliente atinge.
  const sugestoes = acoes
    .filter((a) => registrosAcao.has(a.id) || (codigos.has(a.fator_codigo) && ORDEM[a.nivel_minimo] <= ORDEM[nivel]))
    .sort((a, b) => b.peso_prioridade - a.peso_prioridade)

  async function registrar(acaoId: number, prioridade: number, comentario = comentarios[acaoId] ?? '') {
    setErroAcao(null)
    setRegistrando((ids) => [...ids, acaoId])
    try {
      const { data, error } = await supabase.from('acao_aplicada').insert({
        cliente_id: id,
        acao_id: acaoId,
        analise_id: analise?.id ?? null,
        status: 'PLANEJADA',
        prioridade,
        sugerida_em: new Date().toISOString(),
        observacao: comentario.trim() || null,
      }).select('id, acao_id, sugerida_em, observacao').single()
      if (error) setErroAcao(error.message)
      else {
        setRegistradas((registros) => [...registros, data as AcaoAplicada])
        setComentarios((valores) => ({ ...valores, [acaoId]: '' }))
      }
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível registrar a ação.')
    } finally {
      setRegistrando((ids) => ids.filter((registroId) => registroId !== acaoId))
    }
  }

  return (
    <>
      <Link to="/" className="rotulo hover:underline">← Painel</Link>
      <p className="rotulo mt-4">UC09 · Detalhes do cliente</p>
      <h1 className="mb-1 text-2xl font-bold uppercase">{cliente.razao_social}</h1>
      <p className="mb-6 text-sm text-suave">
        {cliente.segmento} · plano {cliente.plano} · cliente desde {fmtData(cliente.data_inicio_contrato)}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Secao titulo="Risco de churn">
          {analise && analise.score !== null ? (
            <>
              <div className="mb-4 flex items-center gap-4">
                <span className="text-4xl font-bold tabular-nums">{analise.score.toFixed(2)}</span>
                <RiscoBadge nivel={nivel} />
              </div>
              <p className="mb-3 text-xs text-suave">Última análise: {fmtDataHora(analise.executada_em)}</p>
              <p className="rotulo mb-2">Fatores predominantes</p>
              <ul className="space-y-3">
                {fatores.map((f) => (
                  <li key={f.fator_codigo}>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">{f.fator.nome}</span>
                      <span className="tabular-nums">{pct(f.contribuicao)}</span>
                    </div>
                    <div className="my-1 h-1.5 bg-linha"><div className="h-full bg-aco" style={{ width: pct(f.contribuicao) }} /></div>
                    <p className="text-xs text-suave">{f.fator.descricao}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-suave">Cliente sem score: dados insuficientes ou análise ainda não executada.</p>
          )}
        </Secao>

        <Secao titulo="UC10 · Sugestões de retenção">
          {nivel === 'BAIXO' && <p className="text-sm text-suave">Risco baixo: sem ação prioritária.</p>}
          {nivel === 'SEM_SCORE' && <p className="text-sm text-suave">Sem score: não há sugestões.</p>}
          {(nivel === 'MEDIO' || nivel === 'ALTO') && sugestoes.length === 0 && (
            <p className="text-sm">Nenhuma regra corresponde aos fatores. Sugestão genérica: <b>contato ativo</b> com o cliente.</p>
          )}
          <ul className="space-y-3">
            {sugestoes.map((a) => {
              const historico = (registrosAcao.get(a.id) ?? []).sort(
                (anterior, atual) => atual.sugerida_em.localeCompare(anterior.sugerida_em),
              )
              const registrada = historico.length > 0
              return (
                <li key={a.id} className="border border-linha p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{a.nome}</p>
                      <p className="text-xs text-suave">{a.descricao}</p>
                    </div>
                    <button
                      disabled={registrada || registrando.includes(a.id)}
                      onClick={() => registrar(a.id, a.peso_prioridade)}
                      className="shrink-0 border border-aco px-3 py-1 text-xs font-bold uppercase tracking-wider text-aco hover:bg-aco hover:text-white disabled:border-linha disabled:text-suave disabled:hover:bg-transparent"
                    >
                      {registrando.includes(a.id) ? 'Registrando…' : registrada ? 'Registrada' : 'Registrar'}
                    </button>
                  </div>
                  {registrada && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-suave">Histórico de registros</p>
                      <ul className="mt-1 space-y-2 text-xs text-suave">
                        {historico.map((registro) => (
                          <li key={registro.id} className="border-l-2 border-linha pl-2">
                            <p>{fmtDataHora(registro.sugerida_em)}</p>
                            {registro.observacao && <p>{registro.observacao}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <label className="mt-3 block text-xs text-suave">
                    {registrada ? 'Novo comentário' : 'Comentário (opcional)'}
                    <textarea
                      value={comentarios[a.id] ?? ''}
                      onChange={(e) => setComentarios((valores) => ({ ...valores, [a.id]: e.target.value }))}
                      rows={2}
                      className="mt-1 block w-full border border-linha p-2 text-sm text-aco"
                      placeholder="Adicione uma observação sobre esta ação"
                    />
                  </label>
                  {registrada && (
                    <button
                      disabled={registrando.includes(a.id) || !(comentarios[a.id] ?? '').trim()}
                      onClick={() => registrar(a.id, a.peso_prioridade)}
                      className="mt-2 border border-aco px-3 py-1 text-xs font-bold uppercase tracking-wider text-aco hover:bg-aco hover:text-white disabled:border-linha disabled:text-suave disabled:hover:bg-transparent"
                    >
                      {registrando.includes(a.id) ? 'Registrando…' : 'Registrar novo comentário'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {erroAcao && <p className="mt-3 text-sm text-risco-alto">{erroAcao}</p>}
        </Secao>

        <Secao titulo="Uso (últimos meses)">
          {uso.length === 0 ? <p className="text-sm text-suave">Sem dados de uso: histórico incompleto.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="rotulo text-left"><th>Mês</th><th>Acessos</th><th>Minutos</th><th>Usuários</th></tr></thead>
              <tbody className="tabular-nums">
                {uso.map((u) => (
                  <tr key={u.competencia}><td>{u.competencia.slice(0, 7)}</td><td>{u.qtd_acessos}</td><td>{u.minutos_uso}</td><td>{u.qtd_usuarios_ativos}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Secao>

        <Secao titulo="NPS">
          {nps.length === 0 ? <p className="text-sm text-suave">Sem avaliações de NPS.</p> : (
            <ul className="text-sm tabular-nums">
              {nps.map((n) => <li key={n.data_coleta}>{fmtData(n.data_coleta)} — nota <b>{n.nota}</b></li>)}
            </ul>
          )}
        </Secao>

        <div className="md:col-span-2">
          <Secao titulo="Atendimentos recentes">
            {atendimentos.length === 0 ? <p className="text-sm text-suave">Sem atendimentos registrados.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="rotulo text-left"><th>Protocolo</th><th>Assunto</th><th>Criticidade</th><th>Status</th><th>Resposta (h)</th></tr></thead>
                <tbody>
                  {atendimentos.map((t) => (
                    <tr key={t.id}>
                      <td>{t.protocolo}</td><td>{t.assunto ?? '—'}</td><td>{t.criticidade}</td><td>{t.status}</td>
                      <td className="tabular-nums">{t.tempo_resposta_horas ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Secao>
        </div>
      </div>
    </>
  )
}
