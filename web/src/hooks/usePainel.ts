import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LinhaPainel, NivelRisco } from '../types'
import { ORDEM } from '../lib/risco'
import { validarDadosBasicos } from '../lib/validacaoCliente'

interface ClientePainel {
  id: number
  razao_social: string
  cnpj: string | null
  segmento: string
  plano: string
  valor_mensal: number | null
  data_inicio_contrato: string
  avaliacao_nps: { nota: number; data_coleta: string }[]
  analise_risco: {
    id: number
    score: number | null
    nivel_risco: NivelRisco
    executada_em: string
    vigente: boolean
  }[]
}

// Exibe clientes com score em ordem de risco e mantém os sem score fora do ranking.
export function usePainel(filtro: NivelRisco | 'TODOS') {
  const [todasLinhas, setTodasLinhas] = useState<LinhaPainel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [revisao, setRevisao] = useState(0)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    supabase
      .from('cliente')
      .select('id, razao_social, cnpj, segmento, plano, valor_mensal, data_inicio_contrato, avaliacao_nps(nota, data_coleta), analise_risco(id, score, nivel_risco, executada_em, vigente)')
      .eq('status', 'ATIVO')
      .order('razao_social')
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) {
          setErro(error.message)
          setCarregando(false)
          return
        }
        setErro(null)
        const clientes = (data as unknown as ClientePainel[] | null) ?? []
        const linhas = clientes.map((cliente): LinhaPainel => {
          const analise = (cliente.analise_risco ?? []).find((item) => item.vigente) ?? null
          const temScore = analise?.score !== null && analise?.score !== undefined && analise.nivel_risco !== 'SEM_SCORE'
          return {
            id: analise?.id ?? cliente.id,
            score: temScore ? analise.score : null,
            nivel_risco: temScore ? analise.nivel_risco : 'SEM_SCORE',
            executada_em: temScore ? analise.executada_em : null,
            cliente: {
              id: cliente.id,
              razao_social: cliente.razao_social,
              segmento: cliente.segmento,
              problemas_cadastro: validarDadosBasicos(cliente),
              avaliacao_nps: cliente.avaliacao_nps ?? [],
            },
          }
        })
        linhas.sort((a, b) => {
          const risco = ORDEM[b.nivel_risco] - ORDEM[a.nivel_risco]
          if (risco !== 0) return risco
          if (a.score !== null && b.score !== null && a.score !== b.score) return b.score - a.score
          return a.cliente.razao_social.localeCompare(b.cliente.razao_social)
        })
        setTodasLinhas(linhas)
        setCarregando(false)
      }, (cause: unknown) => {
        if (!ativo) return
        setErro(cause instanceof Error ? cause.message : 'Erro inesperado ao carregar o painel.')
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [revisao])

  const linhas = useMemo(
    () => filtro === 'TODOS' ? todasLinhas : todasLinhas.filter((linha) => linha.nivel_risco === filtro),
    [filtro, todasLinhas],
  )

  return { linhas, todasLinhas, carregando, erro, recarregar: () => setRevisao((valor) => valor + 1) }
}
