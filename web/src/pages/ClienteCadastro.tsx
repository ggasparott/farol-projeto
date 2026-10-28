import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Aviso from '../components/Aviso'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

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
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)

    const cnpjNormalizado = cnpj.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const { data, error } = await supabase
      .from('cliente')
      .insert({
        razao_social: razaoSocial.trim(),
        cnpj: cnpjNormalizado,
        segmento: segmento.trim(),
        plano: plano.trim(),
        valor_mensal: valorMensal === '' ? null : Number(valorMensal),
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

    navigate(`/clientes/${data.id}`)
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

      <form onSubmit={cadastrar} className="max-w-3xl space-y-5 border border-linha bg-white p-5">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold md:col-span-2">
            Razão social
            <input
              required
              minLength={2}
              maxLength={150}
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              className="mt-1 block w-full border border-linha p-2 font-normal focus:border-aco focus:outline-none"
            />
          </label>

          <label className="text-sm font-bold">
            CNPJ
            <input
              required
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              className="mt-1 block w-full border border-linha p-2 font-normal focus:border-aco focus:outline-none"
            />
          </label>

          <label className="text-sm font-bold">
            Data de início do contrato
            <input
              required
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1 block w-full border border-linha p-2 font-normal focus:border-aco focus:outline-none"
            />
          </label>

          <label className="text-sm font-bold">
            Segmento
            <input
              required
              maxLength={80}
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              placeholder="Ex.: Tecnologia"
              className="mt-1 block w-full border border-linha p-2 font-normal focus:border-aco focus:outline-none"
            />
          </label>

          <label className="text-sm font-bold">
            Plano
            <input
              required
              maxLength={60}
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              placeholder="Ex.: Profissional"
              className="mt-1 block w-full border border-linha p-2 font-normal focus:border-aco focus:outline-none"
            />
          </label>

          <label className="text-sm font-bold">
            Valor mensal
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorMensal}
              onChange={(e) => setValorMensal(e.target.value)}
              placeholder="Opcional"
              className="mt-1 block w-full border border-linha p-2 font-normal focus:border-aco focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-aco px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-marinho disabled:bg-linha disabled:text-suave"
          >
            {salvando ? 'Salvando…' : 'Cadastrar cliente'}
          </button>
          <Link to="/" className="border border-linha px-4 py-2 text-xs font-bold uppercase tracking-wider text-suave hover:border-aco hover:text-aco">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  )
}
