import { useState } from 'react'
import Papa from 'papaparse'
import { Link } from 'react-router-dom'
import Aviso from '../components/Aviso'
import { supabase } from '../lib/supabase'
import type { Importacao, ImportacaoErro } from '../types'

const TIPOS = {
  CLIENTE: { rotulo: 'Clientes', colunas: ['razao_social', 'cnpj', 'segmento', 'plano', 'valor_mensal', 'data_inicio_contrato'] },
  USO: { rotulo: 'Uso mensal', colunas: ['cnpj', 'competencia', 'qtd_acessos', 'minutos_uso', 'qtd_usuarios_ativos'] },
  ATENDIMENTO: { rotulo: 'Atendimentos', colunas: ['cnpj', 'protocolo', 'assunto', 'criticidade', 'status', 'aberto_em', 'primeira_resposta_em', 'fechado_em'] },
  NPS: { rotulo: 'NPS', colunas: ['cnpj', 'nota', 'comentario', 'data_coleta'] },
} as const
type Tipo = keyof typeof TIPOS
type Arquivos = Record<Tipo, File | null>
type ResumoLote = { tipo: Tipo; lote: Importacao; erros: ImportacaoErro[] }

function mensagemLegivel(mensagem: string): string {
  if (/^(O arquivo|O CSV|Os dados|Não foi possível|Há |A criticidade|O status|O CNPJ|A razão|O valor|Acessos|A nota|A primeira|O fechamento|Esta linha|Falta)/.test(mensagem)) {
    return mensagem
  }

  const clienteNaoEncontrado = mensagem.match(/Cliente com CNPJ (.+?) nao encontrado/i)
  if (clienteNaoEncontrado) {
    return `O CNPJ ${clienteNaoEncontrado[1]} não está cadastrado. Importe os clientes antes deste arquivo.`
  }
  if (/cnpj invalido|ck_cliente_cnpj|cnpj.*check constraint/i.test(mensagem)) {
    return 'O CNPJ é inválido. Confira os 12 caracteres e os 2 dígitos verificadores.'
  }
  if (/colunas ausentes no arquivo:/i.test(mensagem)) {
    const colunas = mensagem.split(':').slice(1).join(':').trim()
    return `O arquivo está sem as seguintes colunas obrigatórias: ${colunas}. Confira o cabeçalho do CSV.`
  }
  if (/o arquivo não contém linhas/i.test(mensagem)) {
    return 'O arquivo não tem dados para importar. Adicione pelo menos uma linha e tente novamente.'
  }
  if (/invalid input syntax for type (integer|numeric|smallint)/i.test(mensagem)) {
    return 'Há um valor numérico inválido. Confira os números e use ponto para separar as casas decimais.'
  }
  if (/invalid input syntax for type (date|timestamp(?: with time zone)?)|date\/time field value out of range|timestamp out of range/i.test(mensagem)) {
    return 'Há uma data ou horário inválido. Use AAAA-MM-DD para datas e inclua o horário quando a coluna exigir.'
  }
  if (/invalid input value for enum criticidade_ticket/i.test(mensagem)) {
    return 'A criticidade do atendimento é inválida. Use BAIXA, MEDIA, ALTA ou CRITICA.'
  }
  if (/invalid input value for enum status_atendimento/i.test(mensagem)) {
    return 'O status do atendimento é inválido. Use ABERTO, EM_ANDAMENTO, RESOLVIDO ou CANCELADO.'
  }
  if (/ck_cliente_razao_social/i.test(mensagem)) {
    return 'A razão social deve ter pelo menos 2 caracteres.'
  }
  if (/ck_cliente_valor/i.test(mensagem)) {
    return 'O valor mensal não pode ser negativo.'
  }
  if (/ck_dado_uso_valores/i.test(mensagem)) {
    return 'Acessos, minutos de uso e usuários ativos não podem ser negativos.'
  }
  if (/ck_nps_nota/i.test(mensagem)) {
    return 'A nota NPS deve ser um número entre 0 e 10.'
  }
  if (/ck_atendimento_resposta/i.test(mensagem)) {
    return 'A primeira resposta não pode ser anterior à abertura do atendimento.'
  }
  if (/ck_atendimento_fechamento/i.test(mensagem)) {
    return 'O fechamento não pode ser anterior à abertura do atendimento.'
  }
  if (/violates not-null constraint|null value in column/i.test(mensagem)) {
    return 'Falta preencher um campo obrigatório nesta linha. Confira as colunas e os valores do arquivo.'
  }
  if (/value too long for type character varying/i.test(mensagem)) {
    return 'Um dos campos de texto excede o tamanho permitido. Revise os valores desta linha.'
  }
  if (/duplicate key value violates unique constraint/i.test(mensagem)) {
    return 'Esta linha repete um registro que já existe. Confira os dados duplicados no arquivo.'
  }
  if (/p_linhas deve ser um array|tipo de importacao invalido/i.test(mensagem)) {
    return 'Não foi possível processar o formato do arquivo. Confira se ele é um CSV válido e tente novamente.'
  }

  return 'Não foi possível validar esta linha. Confira os valores e o formato das colunas.'
}

async function lerCsv(tipo: Tipo, arquivo: File): Promise<Record<string, string>[]> {
  const { data, errors, meta } = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) =>
    Papa.parse<Record<string, string>>(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject,
    }),
  )
  if (errors.length > 0) {
    throw new Error(`O CSV de ${TIPOS[tipo].rotulo.toLowerCase()} tem linhas com formato irregular. Confira os separadores e as colunas.`)
  }

  const faltando = TIPOS[tipo].colunas.filter((coluna) => !meta.fields?.includes(coluna))
  if (faltando.length > 0) {
    throw new Error(`O arquivo de ${TIPOS[tipo].rotulo.toLowerCase()} está sem as colunas obrigatórias: ${faltando.join(', ')}.`)
  }
  if (data.length === 0) {
    throw new Error(`O arquivo de ${TIPOS[tipo].rotulo.toLowerCase()} não contém linhas.`)
  }
  return data
}

function baixarModelo(tipo: Tipo) {
  const csv = Papa.unparse([TIPOS[tipo].colunas])
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `modelo_${tipo.toLowerCase()}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function Importar() {
  const [arquivos, setArquivos] = useState<Arquivos>({
    CLIENTE: null,
    USO: null,
    ATENDIMENTO: null,
    NPS: null,
  })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resumos, setResumos] = useState<ResumoLote[]>([])

  async function importar() {
    const selecionados = (Object.keys(TIPOS) as Tipo[])
      .flatMap((tipo) => {
        const arquivo = arquivos[tipo]
        return arquivo ? [{ tipo, arquivo }] : []
      })
    if (selecionados.length === 0) return

    setErro(null)
    setResumos([])
    setEnviando(true)
    try {
      const importacoes: Record<string, { arquivo: string; linhas: Record<string, string>[] }> = {}
      for (const { tipo, arquivo } of selecionados) {
        importacoes[tipo] = { arquivo: arquivo.name, linhas: await lerCsv(tipo, arquivo) }
      }

      const { data, error } = await supabase.rpc('fn_importar_conjunto', { p_importacoes: importacoes })
      if (error) throw new Error(mensagemLegivel(error.message))
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('A resposta da importação foi inválida. Nenhum resumo pôde ser carregado.')
      }

      const ids = data as Record<string, unknown>
      const { error: erroCalculo } = await supabase.functions.invoke('classificar-risco')
      const novosResumos = await Promise.all(selecionados.map(async ({ tipo }) => {
        const id = ids[tipo]
        if (typeof id !== 'number') {
          throw new Error(`A importação de ${TIPOS[tipo].rotulo.toLowerCase()} não retornou um identificador válido.`)
        }
        const [lote, erros] = await Promise.all([
          supabase.from('importacao').select('*').eq('id', id).single(),
          supabase.from('importacao_erro').select('numero_linha, mensagem').eq('importacao_id', id).order('numero_linha'),
        ])
        if (lote.error || erros.error) {
          throw new Error('Os dados foram importados, mas não foi possível carregar o resumo de todos os arquivos.')
        }
        return { tipo, lote: lote.data as Importacao, erros: (erros.data as ImportacaoErro[]) ?? [] }
      }))

      setResumos(novosResumos)
      if (erroCalculo) {
        setErro('Os dados foram importados, mas não foi possível atualizar a classificação de risco. Tente novamente mais tarde.')
      }
    } catch (e) {
      setErro(mensagemLegivel(e instanceof Error ? e.message : ''))
    } finally {
      setEnviando(false)
    }
  }

  const temArquivo = Object.values(arquivos).some(Boolean)

  return (
    <>
      <p className="rotulo">UC02 · Importação</p>
      <h1 className="mb-6 text-2xl font-bold uppercase">Importar dados de clientes</h1>

      <div className="max-w-3xl border border-linha bg-white p-5">
        <p className="mb-4 text-sm text-suave">
          Selecione um ou mais arquivos CSV. Todos serão validados e enviados em conjunto; clientes são processados antes dos demais dados.
          O CNPJ é validado, incluindo os dígitos verificadores.
        </p>
        <div className="space-y-4">
          {(Object.keys(TIPOS) as Tipo[]).map((tipo) => (
            <div key={tipo} className="border-b border-linha pb-4 last:border-0 last:pb-0">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`arquivo-${tipo}`} className="text-sm font-bold">{TIPOS[tipo].rotulo}</label>
                <button
                  type="button"
                  onClick={() => baixarModelo(tipo)}
                  className="text-xs font-bold uppercase tracking-wider text-aco underline"
                >
                  Baixar modelo CSV
                </button>
              </div>
              <p className="mb-2 text-xs text-suave">
                Colunas: <code>{TIPOS[tipo].colunas.join(', ')}</code>
              </p>
              <input
                id={`arquivo-${tipo}`}
                type="file"
                accept=".csv,text/csv"
                disabled={enviando}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0] ?? null
                  setArquivos((atuais) => ({ ...atuais, [tipo]: arquivo }))
                  setResumos([])
                  setErro(null)
                }}
                className="block w-full text-sm"
              />
            </div>
          ))}
        </div>
        <button
          onClick={importar}
          disabled={!temArquivo || enviando}
          className="mt-5 bg-aco px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-marinho disabled:bg-linha disabled:text-suave"
        >
          {enviando ? 'Validando e importando…' : 'Importar arquivos selecionados'}
        </button>
      </div>

      <div className="mt-6 max-w-3xl space-y-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {resumos.map(({ tipo, lote, erros }) => (
          <section key={lote.id} className="space-y-3">
            <div className="border border-linha bg-white p-5">
              <p className="rotulo mb-2">Resumo · {TIPOS[tipo].rotulo} · {lote.status}</p>
              <p className="text-sm tabular-nums">
                {lote.total_linhas} linhas · <b>{lote.total_gravados}</b> gravadas ·{' '}
                <b>{lote.total_rejeitados}</b> rejeitadas
              </p>
              <Link to="/" className="mt-3 inline-block text-xs font-bold uppercase tracking-wider text-aco underline">Ir ao painel</Link>
            </div>
            {erros.length > 0 && (
              <div className="border border-linha bg-white p-5">
                <p className="rotulo mb-2">Inconsistências · {TIPOS[tipo].rotulo}</p>
                <ul className="space-y-1 text-sm">
                  {erros.map((r) => (
                    <li key={r.numero_linha}>Linha {r.numero_linha}: {mensagemLegivel(r.mensagem)}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
