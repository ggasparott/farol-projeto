import { useState } from 'react'
import Papa from 'papaparse'
import { Link } from 'react-router-dom'
import Aviso from '../components/Aviso'
import { supabase } from '../lib/supabase'
import type { Importacao, ImportacaoErro } from '../types'

// Clientes primeiro: os demais tipos referenciam o cliente pelo CNPJ.
const TIPOS = {
  CLIENTE: { rotulo: 'Clientes', colunas: ['razao_social', 'cnpj', 'segmento', 'plano', 'valor_mensal', 'data_inicio_contrato'] },
  USO: { rotulo: 'Uso mensal', colunas: ['cnpj', 'competencia', 'qtd_acessos', 'minutos_uso', 'qtd_usuarios_ativos'] },
  ATENDIMENTO: { rotulo: 'Atendimentos', colunas: ['cnpj', 'protocolo', 'assunto', 'criticidade', 'status', 'aberto_em', 'primeira_resposta_em', 'fechado_em'] },
  NPS: { rotulo: 'NPS', colunas: ['cnpj', 'nota', 'comentario', 'data_coleta'] },
} as const
type Tipo = keyof typeof TIPOS

function mensagemLegivel(mensagem: string): string {
  if (/^(O arquivo|O CSV|Os dados|Não foi possível|Há |A criticidade|O status|O CNPJ|A razão|O valor|Acessos|A nota|A primeira|O fechamento|Esta linha|Falta)/.test(mensagem)) {
    return mensagem
  }

  const clienteNaoEncontrado = mensagem.match(/Cliente com CNPJ (.+?) nao encontrado/i)
  if (clienteNaoEncontrado) {
    return `O CNPJ ${clienteNaoEncontrado[1]} não está cadastrado. Importe os clientes antes deste arquivo.`
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
  if (/ck_cliente_cnpj|cnpj.*check constraint/i.test(mensagem)) {
    return 'O CNPJ deve conter exatamente 14 números, sem pontuação.'
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

export default function Importar() {
  const [tipo, setTipo] = useState<Tipo>('CLIENTE')
  const COLUNAS: readonly string[] = TIPOS[tipo].colunas
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resumo, setResumo] = useState<{ lote: Importacao; erros: ImportacaoErro[] } | null>(null)

  async function importar() {
    if (!arquivo) return
    setErro(null)
    setResumo(null)
    setEnviando(true)
    try {
      const { data, errors: errosCsv, meta } = await new Promise<Papa.ParseResult<Record<string, string>>>((ok, falha) =>
        Papa.parse<Record<string, string>>(arquivo, { header: true, skipEmptyLines: true, complete: ok, error: falha }),
      )
      if (errosCsv.length > 0) {
        throw new Error('O CSV tem linhas com formato irregular. Confira os separadores e se todas as linhas têm as mesmas colunas.')
      }
      // UC02/E1: formato invalido -> nada e gravado.
      const faltando = COLUNAS.filter((c) => !meta.fields?.includes(c))
      if (faltando.length > 0) throw new Error(`Colunas ausentes no arquivo: ${faltando.join(', ')}`)
      if (data.length === 0) throw new Error('O arquivo não contém linhas.')

      const { data: id, error } = tipo === 'CLIENTE'
        ? await supabase.rpc('fn_importar_lote', { p_origem: 'ARQUIVO_CSV', p_arquivo: arquivo.name, p_linhas: data })
        : await supabase.rpc('fn_importar_dados', { p_tipo: tipo, p_arquivo: arquivo.name, p_linhas: data })
      if (error) throw new Error(mensagemLegivel(error.message))

      // Classificacao por IA (OpenAI) via Edge Function; ela cai nas regras se a IA falhar.
      const { error: erroCalculo } = await supabase.functions.invoke('classificar-risco')
      if (erroCalculo) throw new Error('Os dados foram importados, mas não foi possível atualizar a classificação de risco. Tente novamente mais tarde.')

      const [lote, erros] = await Promise.all([
        supabase.from('importacao').select('*').eq('id', id).single(),
        supabase.from('importacao_erro').select('numero_linha, mensagem').eq('importacao_id', id).order('numero_linha'),
      ])
      if (lote.error) throw new Error('Os dados foram importados, mas não foi possível carregar o resumo da importação.')
      setResumo({ lote: lote.data as Importacao, erros: (erros.data as ImportacaoErro[]) ?? [] })
    } catch (e) {
      setErro(mensagemLegivel(e instanceof Error ? e.message : ''))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <p className="rotulo">UC02 · Importação</p>
      <h1 className="mb-6 text-2xl font-bold uppercase">Importar dados de clientes</h1>

      <div className="max-w-2xl border border-linha bg-white p-5">
        <select
          value={tipo}
          onChange={(e) => { setTipo(e.target.value as Tipo); setResumo(null); setErro(null) }}
          className="mb-3 block border border-linha px-2 py-1 text-sm"
        >
          {(Object.keys(TIPOS) as Tipo[]).map((t) => <option key={t} value={t}>{TIPOS[t].rotulo}</option>)}
        </select>
        <p className="mb-3 text-sm text-suave">
          Selecione um arquivo CSV com as colunas: <code className="text-xs">{COLUNAS.join(', ')}</code>.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setResumo(null); setErro(null) }}
          className="mb-4 block w-full text-sm"
        />
        <button
          onClick={importar}
          disabled={!arquivo || enviando}
          className="bg-aco px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-marinho disabled:bg-linha disabled:text-suave"
        >
          {enviando ? 'Importando…' : 'Importar'}
        </button>
      </div>

      <div className="mt-6 max-w-2xl space-y-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {resumo && (
          <>
            <div className="border border-linha bg-white p-5">
              <p className="rotulo mb-2">Resumo da importação · {resumo.lote.status}</p>
              <p className="text-sm tabular-nums">
                {resumo.lote.total_linhas} linhas · <b>{resumo.lote.total_gravados}</b> gravadas ·{' '}
                <b>{resumo.lote.total_rejeitados}</b> rejeitadas
              </p>
              <Link to="/" className="mt-3 inline-block text-xs font-bold uppercase tracking-wider text-aco underline">Ir ao painel</Link>
            </div>
            {resumo.erros.length > 0 && (
              <div className="border border-linha bg-white p-5">
                <p className="rotulo mb-2">Inconsistências</p>
                <ul className="space-y-1 text-sm">
                  {resumo.erros.map((r) => <li key={r.numero_linha}>Linha {r.numero_linha}: {mensagemLegivel(r.mensagem)}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
