import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LinhaPainel, NivelRisco } from '../types'

// UC08 / UC11: analises vigentes com score, ordenadas do maior para o menor risco.
export function usePainel(filtro: NivelRisco | 'TODOS') {
  const [linhas, setLinhas] = useState<LinhaPainel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [revisao, setRevisao] = useState(0)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    let q = supabase
      .from('analise_risco')
      .select('id, score, nivel_risco, executada_em, cliente:cliente_id(id, razao_social, segmento, avaliacao_nps(nota, data_coleta))')
      .eq('vigente', true)
      .neq('nivel_risco', 'SEM_SCORE')
      .order('nivel_risco', { ascending: false })
      .order('score', { ascending: false })
    if (filtro !== 'TODOS') q = q.eq('nivel_risco', filtro)
    q.then(({ data, error }) => {
      if (!ativo) return
      setErro(error?.message ?? null)
      setLinhas((data as unknown as LinhaPainel[]) ?? [])
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [filtro, revisao])

  return { linhas, carregando, erro, recarregar: () => setRevisao((valor) => valor + 1) }
}
