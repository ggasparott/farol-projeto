import type { NivelRisco } from '../types'

export const ORDEM: Record<NivelRisco, number> = { SEM_SCORE: 0, BAIXO: 1, MEDIO: 2, ALTO: 3 }

export const ROTULO: Record<NivelRisco, string> = {
  SEM_SCORE: 'Sem score',
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
}

export const COR: Record<NivelRisco, string> = {
  SEM_SCORE: 'border-suave text-suave',
  BAIXO: 'border-risco-baixo text-risco-baixo',
  MEDIO: 'border-risco-medio text-risco-medio',
  ALTO: 'border-risco-alto text-risco-alto',
}

export const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
export const fmtDataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR')
export const pct = (n: number) => `${Math.round(n * 100)}%`
