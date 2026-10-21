import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Aviso from '../components/Aviso'

export default function Cadastro() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)
    setErro(null)

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome } // Passa o nome para ser capturado pela trigger do Supabase
      }
    })

    if (error) {
      setErro(error.message)
      setCarregando(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-8">
      <div className="text-center">
        <p className="rotulo">Farol CS · Novo Registro</p>
        <h1 className="text-2xl font-bold uppercase mt-1">Criar Conta de Analista</h1>
      </div>

      <form onSubmit={handleCadastro} className="space-y-4 border border-linha bg-white p-6 shadow-sm">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div>
          <label className="block text-xs font-bold uppercase text-suave mb-1">Nome Completo</label>
          <input
            type="text"
            required
            className="w-full border border-linha p-2 text-sm focus:border-aco focus:outline-none"
            placeholder="Ex: Carlos da Silva"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-suave mb-1">E-mail corporativo</label>
          <input
            type="email"
            required
            className="w-full border border-linha p-2 text-sm focus:border-aco focus:outline-none"
            placeholder="seu.email@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-suave mb-1">Senha (mínimo 6 caracteres)</label>
          <input
            type="password"
            required
            minLength={6}
            className="w-full border border-linha p-2 text-sm focus:border-aco focus:outline-none"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-suave mb-1">Confirmar Senha</label>
          <input
            type="password"
            required
            className="w-full border border-linha p-2 text-sm focus:border-aco focus:outline-none"
            placeholder="••••••••"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-aco text-white font-bold py-2 uppercase text-xs tracking-wider hover:bg-black disabled:opacity-50"
        >
          {carregando ? 'Cadastrando…' : 'Criar Conta'}
        </button>

        <div className="text-center pt-2 text-xs text-suave">
          Já possui conta?{' '}
          <Link to="/login" className="font-bold text-aco underline">
            Faça login
          </Link>
        </div>
      </form>
    </div>
  )
}