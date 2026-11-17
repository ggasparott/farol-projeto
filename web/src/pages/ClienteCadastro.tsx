import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Aviso from '../components/Aviso'
import { useAuth } from '../contexts/AuthContext'
import { CAMPOS_OBRIGATORIOS, ROTULO_CAMPO, normalizarValor, validarCampos } from '../lib/validacaoCliente'
import type { CampoCliente } from '../lib/validacaoCliente'
import { supabase } from '../lib/supabase'

type ArquivosExtras = {
  USO: File | null
  ATENDIMENTO: File | null
  NPS: File | null
}

function mensagemCadastro(mensagem: string) {
  if (/uq_cliente_cnpj|duplicate key/i.test(mensagem)) return 'Já existe um cliente cadastrado com este CNPJ.'
  if (/ck_cliente_cnpj/i.test(mensagem)) return 'Informe um CNPJ válido, com os dígitos verificadores corretos.'
  if (/ck_cliente_valor/i.test(mensagem)) return 'O valor mensal não pode ser negativo.'
  return mensagem
}

export default function ClienteCadastro() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [segmento, setSegmento] = useState('')
  const [plano, setPlano] = useState('')
  const [valorMensal, setValorMensal] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [arquivosExtras, setArquivosExtras] = useState<ArquivosExtras>({
    USO: null,
    ATENDIMENTO: null,
    NPS: null,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tocados, setTocados] = useState<Partial<Record<CampoCliente, boolean>>>({})
  const [tentouEnviar, setTentouEnviar] = useState(false)

  const errosCampos = validarCampos({ razao_social: razaoSocial, cnpj, segmento, plano, valor_mensal: valorMensal, data_inicio_contrato: dataInicio })
  const ausentes = CAMPOS_OBRIGATORIOS.filter((campo) => errosCampos[campo]?.includes('não informad'))
  const mostrarErro = (campo: CampoCliente) => (tentouEnviar || tocados[campo]) ? errosCampos[campo] : undefined
  const tocar = (campo: CampoCliente) => () => setTocados((atual) => ({ ...atual, [campo]: true }))
  const classeCampo = (campo: CampoCliente) => `mt-1 block w-full border p-2 font-normal focus:outline-none ${mostrarErro(campo) ? 'border-risco-alto bg-[#fff0ec] focus:border-risco-alto' : 'border-linha focus:border-aco'}`
  const obrigatorio = <span className="text-risco-alto" aria-hidden="true"> *</span>
  const erroCampo = (campo: CampoCliente) => mostrarErro(campo) ? <span id={`erro-${campo}`} className="mt-1 block text-xs font-semibold text-risco-alto">{mostrarErro(campo)}</span> : null
  const aria = (campo: CampoCliente) => ({ 'aria-invalid': Boolean(mostrarErro(campo)), 'aria-describedby': mostrarErro(campo) ? `erro-${campo}` : undefined, onBlur: tocar(campo) })

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    setTentouEnviar(true)
    if (Object.keys(errosCampos).length > 0) {
      setErro('Revise os campos destacados antes de cadastrar.')
      return
    }
    const cnpjNormalizado = cnpj.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

    setSalvando(true)
    const { data, error } = await supabase
      .from('cliente')
      .insert({
        razao_social: razaoSocial.trim(),
        cnpj: cnpjNormalizado,
        segmento: segmento.trim(),
        plano: plano.trim(),
        valor_mensal: normalizarValor(valorMensal),
        data_inicio_contrato: dataInicio,
        usuario_id: user?.id ?? null,
      })
      .select('id')
      .single()

    if (error) {
      setErro(mensagemCadastro(error.message))
      setSalvando(false)
      return
    }

    const extrasSelecionados = Object.fromEntries(
      Object.entries(arquivosExtras).filter(([, arquivo]) => arquivo !== null),
    ) as Partial<ArquivosExtras>
    if (Object.keys(extrasSelecionados).length > 0) {
      navigate(`/importar?clienteId=${data.id}&cadastro=novo`, {
        state: { importarAutomaticamente: true, arquivosExtras: extrasSelecionados },
      })
    } else {
      navigate(`/clientes/${data.id}`)
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rotulo">UC01 · Cadastro de cliente</p>
          <h1 className="text-2xl font-bold uppercase">Cadastrar cliente</h1>
        </div>
        <Link
          to="/importar"
          className="border border-aco px-4 py-2 text-xs font-bold uppercase tracking-wider text-aco hover:bg-petroleo-claro"
        >
          Importar clientes por CSV
        </Link>
      </header>

      <form onSubmit={cadastrar} noValidate className="max-w-3xl space-y-5 border border-linha bg-white p-5">
        <p className="text-xs text-suave">Campos marcados com <span className="font-bold text-risco-alto">*</span> são obrigatórios.</p>
        {erro && <Aviso tipo="erro">
          <p className="font-bold">{erro}</p>
          {tentouEnviar && ausentes.length > 0 && <p className="mt-1">Faltam dados importantes: {ausentes.map((campo) => ROTULO_CAMPO[campo]).join(', ')}.</p>}
        </Aviso>}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold md:col-span-2">
            Razão social{obrigatorio}
            <input
              required
              minLength={2}
              maxLength={150}
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              {...aria('razao_social')}
              className={classeCampo('razao_social')}
            />
            {erroCampo('razao_social')}
          </label>

          <label className="text-sm font-bold">
            CNPJ{obrigatorio}
            <input
              required
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              {...aria('cnpj')}
              className={classeCampo('cnpj')}
            />
            {erroCampo('cnpj')}
          </label>

          <label className="text-sm font-bold">
            Data de início do contrato{obrigatorio}
            <input
              required
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              {...aria('data_inicio_contrato')}
              className={classeCampo('data_inicio_contrato')}
            />
            {erroCampo('data_inicio_contrato')}
          </label>

          <label className="text-sm font-bold">
            Segmento{obrigatorio}
            <input
              required
              maxLength={80}
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              placeholder="Ex.: Tecnologia"
              {...aria('segmento')}
              className={classeCampo('segmento')}
            />
            {erroCampo('segmento')}
          </label>

          <label className="text-sm font-bold">
            Plano{obrigatorio}
            <input
              required
              maxLength={60}
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              placeholder="Ex.: Profissional"
              {...aria('plano')}
              className={classeCampo('plano')}
            />
            {erroCampo('plano')}
          </label>

          <label className="text-sm font-bold">
            Valor mensal
            <input
              inputMode="decimal"
              value={valorMensal}
              onChange={(e) => setValorMensal(e.target.value)}
              placeholder="Opcional"
              {...aria('valor_mensal')}
              className={classeCampo('valor_mensal')}
            />
            {erroCampo('valor_mensal')}
          </label>
        </div>

        <fieldset className="space-y-4 border-t border-linha pt-5">
          <legend className="px-1 text-sm font-bold">Dados extras (opcional)</legend>
          <p className="text-sm text-suave">
            Selecione arquivos CSV de uso, atendimentos ou NPS. Depois de criar o cliente, eles serão importados automaticamente apenas para este CNPJ.
          </p>
          {([
            ['USO', 'Uso mensal'],
            ['ATENDIMENTO', 'Atendimentos'],
            ['NPS', 'NPS'],
          ] as const).map(([tipo, rotulo]) => (
            <label key={tipo} className="block text-sm font-bold">
              {rotulo}
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={salvando}
                onChange={(e) => setArquivosExtras((atuais) => ({
                  ...atuais,
                  [tipo]: e.target.files?.[0] ?? null,
                }))}
                className="mt-1 block w-full font-normal"
              />
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-aco px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-marinho disabled:bg-linha disabled:text-suave"
          >
            {salvando ? 'Salvando…' : Object.values(arquivosExtras).some(Boolean) ? 'Cadastrar e importar dados' : 'Cadastrar cliente'}
          </button>
          <Link to="/" className="border border-linha px-4 py-2 text-xs font-bold uppercase tracking-wider text-suave hover:border-aco hover:text-aco">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  )
}
