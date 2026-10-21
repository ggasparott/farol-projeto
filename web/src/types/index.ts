export type NivelRisco = 'SEM_SCORE' | 'BAIXO' | 'MEDIO' | 'ALTO'

export interface Nps {
  nota: number
  data_coleta: string
}

export interface LinhaPainel {
  id: number
  score: number
  nivel_risco: NivelRisco
  executada_em: string
  cliente: {
    id: number
    razao_social: string
    segmento: string
    avaliacao_nps: Nps[]
  }
}

export interface Fator {
  codigo: string
  nome: string
  descricao: string
}

export interface FatorRisco {
  fator_codigo: string
  valor_observado: number | null
  contribuicao: number
  fator: Fator
}

export interface AnaliseDetalhe {
  id: number
  score: number | null
  nivel_risco: NivelRisco
  executada_em: string
  fator_risco: FatorRisco[]
}

export interface Cliente {
  id: number
  razao_social: string
  cnpj: string | null
  segmento: string
  plano: string
  valor_mensal: number | null
  data_inicio_contrato: string
  status: string
}

export interface DadoUso {
  competencia: string
  qtd_acessos: number
  minutos_uso: number
  qtd_usuarios_ativos: number
}

export interface Atendimento {
  id: number
  protocolo: string
  assunto: string | null
  criticidade: string
  status: string
  aberto_em: string
  tempo_resposta_horas: number | null
}

export interface AcaoRetencao {
  id: number
  nome: string
  descricao: string
  fator_codigo: string
  nivel_minimo: NivelRisco
  peso_prioridade: number
}

export interface AcaoAplicada {
  id: number
  acao_id: number
  sugerida_em: string
  observacao: string | null
}

export interface Importacao {
  id: number
  status: string
  total_linhas: number
  total_gravados: number
  total_rejeitados: number
}

export interface ImportacaoErro {
  numero_linha: number
  mensagem: string
}
