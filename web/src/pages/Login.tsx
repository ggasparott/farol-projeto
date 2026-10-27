import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Aviso from '../components/Aviso'
import AuthLayout, { FieldIcon, authInputClass } from '../components/AuthLayout'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setCarregando(true); setErro(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message); setCarregando(false) } else navigate('/')
  }

  return <AuthLayout>
    <div className="mb-8"><p className="rotulo mb-3">Acesso seguro</p><h2 className="text-4xl font-extrabold tracking-[-.035em] sm:text-[2.65rem]">Entrar no Farol</h2><p className="mt-3 text-lg text-suave">Use o e-mail e a senha da sua empresa.</p></div>
    <div className="mb-7 flex items-center gap-3 rounded-xl border border-petroleo-claro bg-petroleo-claro/70 px-4 py-3 text-sm font-bold text-aco"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg">○</span><span>Perfil de acesso: Analista de CS</span></div>
    <form onSubmit={handleLogin} className="space-y-5">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <label className="block text-sm font-bold">E-mail<div className="relative mt-2"><FieldIcon><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></FieldIcon><input type="email" autoComplete="email" required className={authInputClass} placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)}/></div></label>
      <label className="block text-sm font-bold">Senha<div className="relative mt-2"><FieldIcon><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></FieldIcon><input type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password" required className={`${authInputClass} pr-20`} placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)}/><button type="button" onClick={() => setMostrarSenha((valor) => !valor)} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-aco hover:text-petroleo" aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>{mostrarSenha ? 'Ocultar' : 'Mostrar'}</button></div></label>
      <div className="pt-1"><button type="submit" disabled={carregando} className="w-full rounded-xl bg-aco py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(23,92,108,.18)] hover:bg-petroleo disabled:opacity-50">{carregando ? 'Entrando…' : 'Entrar'}</button></div>
      <p className="pt-2 text-center text-sm text-suave">Ainda não possui conta? <Link to="/cadastro" className="font-bold text-aco underline decoration-aco/30 underline-offset-4 hover:text-petroleo">Crie sua conta</Link></p>
    </form>
  </AuthLayout>
}
