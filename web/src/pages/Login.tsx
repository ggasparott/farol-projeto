import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Aviso from '../components/Aviso'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
      setCarregando(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-12">
      <div className="text-center">
        <p className="rotulo">Farol CS · Autenticação</p>
        <h1 className="text-2xl font-bold uppercase mt-1">Acessar o Sistema</h1>
      </div>

      <form onSubmit={handleLogin} className="space-y-4 border border-linha bg-white p-6 shadow-sm">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div>
          <label className="block text-xs font-bold uppercase text-suave mb-1">E-mail profissional</label>
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
          <label className="block text-xs font-bold uppercase text-suave mb-1">Senha</label>
          <input
            type="password"
            required
            className="w-full border border-linha p-2 text-sm focus:border-aco focus:outline-none"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-aco text-white font-bold py-2 uppercase text-xs tracking-wider hover:bg-black disabled:opacity-50"
        >
          {carregando ? 'Entrando…' : 'Entrar no Sistema'}
        </button>

        <div className="text-center pt-2 text-xs text-suave">
          Ainda não possui conta?{' '}
          <Link to="/cadastro" className="font-bold text-aco underline">
            Cadastre-se aqui
          </Link>
        </div>
      </form>
    </div>
  )
}