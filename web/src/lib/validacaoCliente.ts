import { cnpjValido } from './cnpj'

export interface DadosBasicosCliente {
  razao_social: string
  cnpj: string | null
  segmento: string
  plano: string
  valor_mensal: number | string | null
  data_inicio_contrato: string
}

export function validarDadosBasicos(cliente: DadosBasicosCliente): string[] {
  const problemas: string[] = []
  if (!cliente.razao_social?.trim() || cliente.razao_social.trim().length < 2) {
    problemas.push('Razão social ausente ou com menos de 2 caracteres.')
  }
  if (!cliente.cnpj?.trim()) {
    problemas.push('CNPJ não informado.')
  } else if (!cnpjValido(cliente.cnpj)) {
    problemas.push('CNPJ inválido: confira os dígitos verificadores.')
  }
  if (!cliente.segmento?.trim()) problemas.push('Segmento não informado.')
  if (!cliente.plano?.trim()) problemas.push('Plano não informado.')
  const valorMensal = cliente.valor_mensal === '' ? null : cliente.valor_mensal
  if (valorMensal !== null && (!Number.isFinite(Number(valorMensal)) || Number(valorMensal) < 0)) {
    problemas.push('Valor mensal inválido ou negativo.')
  }

  const dataInicio = cliente.data_inicio_contrato
  const dataInicioParseada = new Date(`${dataInicio}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)
    || Number.isNaN(dataInicioParseada.getTime())
    || dataInicioParseada.toISOString().slice(0, 10) !== dataInicio) {
    problemas.push('Data de início do contrato ausente ou inválida.')
  }
  return problemas
}
