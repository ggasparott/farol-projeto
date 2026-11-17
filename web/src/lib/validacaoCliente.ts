import { cnpjValido } from './cnpj'

export interface DadosBasicosCliente {
  razao_social: string
  cnpj: string | null
  segmento: string
  plano: string
  valor_mensal: number | string | null
  data_inicio_contrato: string
}

export type CampoCliente = 'razao_social' | 'cnpj' | 'segmento' | 'plano' | 'valor_mensal' | 'data_inicio_contrato'

// Formatos aceitos em cada campo.
export const REGEX = {
  // Letras (com acento), números e pontuação comum em nomes de empresa.
  razaoSocial: /^[\p{L}\p{N}][\p{L}\p{N} .,&'/()-]{1,149}$/u,
  // CNPJ numérico ou alfanumérico, com ou sem máscara: 00.000.000/0000-00.
  cnpj: /^[A-Z0-9]{2}\.?[A-Z0-9]{3}\.?[A-Z0-9]{3}\/?[A-Z0-9]{4}-?\d{2}$/i,
  // Começa com letra; aceita letras, números, espaço e . & / -
  texto: /^\p{L}[\p{L}\p{N} .&/-]*$/u,
  // Até duas casas decimais, com ponto ou vírgula.
  valor: /^\d+([.,]\d{1,2})?$/,
  data: /^\d{4}-\d{2}-\d{2}$/,
  email: /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i,
  // Pelo menos 8 caracteres, com uma letra e um número.
  senha: /^(?=.*\p{L})(?=.*\d).{8,}$/u,
}

export const MENSAGEM_SENHA = 'A senha precisa ter pelo menos 8 caracteres, com letras e números.'

export const ROTULO_CAMPO: Record<CampoCliente, string> = {
  razao_social: 'Razão social',
  cnpj: 'CNPJ',
  segmento: 'Segmento',
  plano: 'Plano',
  valor_mensal: 'Valor mensal',
  data_inicio_contrato: 'Data de início do contrato',
}

export const CAMPOS_OBRIGATORIOS: CampoCliente[] = ['razao_social', 'cnpj', 'segmento', 'plano', 'data_inicio_contrato']

// Retorna, por campo, o problema encontrado. Campos válidos ficam fora do objeto.
export function validarCampos(cliente: DadosBasicosCliente): Partial<Record<CampoCliente, string>> {
  const erros: Partial<Record<CampoCliente, string>> = {}
  const razao = cliente.razao_social?.trim() ?? ''
  if (!razao) erros.razao_social = 'Razão social não informada.'
  else if (!REGEX.razaoSocial.test(razao)) erros.razao_social = 'Razão social com menos de 2 caracteres ou com símbolos não permitidos.'

  const cnpj = cliente.cnpj?.trim() ?? ''
  if (!cnpj) erros.cnpj = 'CNPJ não informado.'
  else if (!REGEX.cnpj.test(cnpj)) erros.cnpj = 'CNPJ fora do formato 00.000.000/0000-00.'
  else if (!cnpjValido(cnpj)) erros.cnpj = 'CNPJ inválido: confira os dígitos verificadores.'

  for (const campo of ['segmento', 'plano'] as const) {
    const valor = cliente[campo]?.trim() ?? ''
    if (!valor) erros[campo] = `${ROTULO_CAMPO[campo]} não informado.`
    else if (!REGEX.texto.test(valor)) erros[campo] = `${ROTULO_CAMPO[campo]} deve começar com letra e não pode ter símbolos especiais.`
  }

  const valorMensal = cliente.valor_mensal === null || cliente.valor_mensal === undefined ? '' : String(cliente.valor_mensal).trim()
  if (valorMensal !== '' && !REGEX.valor.test(valorMensal)) erros.valor_mensal = 'Valor mensal inválido: use um número positivo com até 2 casas decimais.'

  const dataInicio = cliente.data_inicio_contrato ?? ''
  const dataParseada = new Date(`${dataInicio}T00:00:00Z`)
  if (!dataInicio) erros.data_inicio_contrato = 'Data de início do contrato não informada.'
  else if (!REGEX.data.test(dataInicio) || Number.isNaN(dataParseada.getTime()) || dataParseada.toISOString().slice(0, 10) !== dataInicio) {
    erros.data_inicio_contrato = 'Data de início do contrato inválida.'
  } else if (dataInicio > new Date().toISOString().slice(0, 10)) {
    erros.data_inicio_contrato = 'Data de início do contrato não pode estar no futuro.'
  }
  return erros
}

export function validarDadosBasicos(cliente: DadosBasicosCliente): string[] {
  return Object.values(validarCampos(cliente))
}

export function camposAusentes(cliente: DadosBasicosCliente): CampoCliente[] {
  return CAMPOS_OBRIGATORIOS.filter((campo) => !String(cliente[campo] ?? '').trim())
}

export function normalizarValor(valor: string): number | null {
  const limpo = valor.trim()
  return limpo === '' ? null : Number(limpo.replace(',', '.'))
}
