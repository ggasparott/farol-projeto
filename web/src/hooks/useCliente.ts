import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AcaoRetencao, AnaliseDetalhe, Atendimento, Cliente, DadoUso, Nps } from '../types'

export interface DadosCliente {
  cliente: Cliente
  analise: AnaliseDetalhe | null
  uso: DadoUso[]
  atendimentos: Atendimento[]
  nps: Nps[]
  acoes: AcaoRetencao[]
}

// UC09 + UC10: cadastro, analise vigente com fatores, historico e catalogo de acoes.
export function useCliente(id: number) {
  const [dados, setDados] = useState<DadosCliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [c, a, u, t, n, ac] = await Promise.all([
      supabase.from('cliente').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('analise_risco')
        .select('id, score, nivel_risco, executada_em, fator_risco(fator_codigo, valor_observado, contribuicao, fator(codigo, nome, descricao))')
        .eq('cliente_id', id).eq('vigente', true).maybeSingle(),
      supabase.from('dado_uso').select('*').eq('cliente_id', id).order('competencia', { ascending: false }).limit(6),
      supabase.from('atendimento').select('*').eq('cliente_id', id).order('aberto_em', { ascending: false }).limit(10),
      supabase.from('avaliacao_nps').select('nota, data_coleta').eq('cliente_id', id).order('data_coleta', { ascending: false }).limit(5),
      supabase.from('acao_retencao').select('*').eq('ativo', true),
    ])
    const falha = [c, a, u, t, n, ac].find((r) => r.error)?.error
    setErro(falha?.message ?? null)
    setDados(c.data ? {
      cliente: c.data as Cliente,
      analise: a.data as unknown as AnaliseDetalhe | null,
      uso: (u.data as DadoUso[]) ?? [],
      atendimentos: (t.data as Atendimento[]) ?? [],
      nps: (n.data as Nps[]) ?? [],
      acoes: (ac.data as AcaoRetencao[]) ?? [],
    } : null)
    setCarregando(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  return { dados, carregando, erro }
}
