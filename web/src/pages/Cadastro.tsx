import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Aviso from '../components/Aviso'
import AuthLayout, { FieldIcon, authInputClass } from '../components/AuthLayout'

export default function Cadastro() {
  const [nome, setNome] = useState(''); const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [confirmarSenha, setConfirmarSenha] = useState(''); const [mostrarSenha, setMostrarSenha] = useState(false); const [carregando, setCarregando] = useState(false); const [erro, setErro] = useState<string | null>(null)
  const navigate = useNavigate()
  const forcaSenha = senha.length === 0 ? 0 : senha.length < 6 ? 1 : senha.length < 10 ? 2 : 3
  const handleCadastro = async (e: React.FormEvent) => { e.preventDefault(); if (senha !== confirmarSenha) { setErro('As senhas não coincidem.'); return } setCarregando(true); setErro(null); const { error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } }); if (error) { setErro(error.message); setCarregando(false) } else navigate('/') }
  const iconUser = <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>
  const iconLock = <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></>

  return <AuthLayout cadastro>
    <div className="mb-7"><p className="rotulo mb-3">Novo acesso</p><h2 className="text-4xl font-extrabold tracking-[-.035em] sm:text-[2.65rem]">Criar sua conta</h2><p className="mt-3 text-lg text-suave">Configure seu perfil de analista para começar.</p></div>
    <form onSubmit={handleCadastro} className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <label className="block text-sm font-bold">Nome completo<div className="relative mt-2"><FieldIcon>{iconUser}</FieldIcon><input type="text" autoComplete="name" required minLength={2} className={authInputClass} placeholder="Como você quer ser chamado" value={nome} onChange={(e) => setNome(e.target.value)}/></div></label>
      <label className="block text-sm font-bold">E-mail corporativo<div className="relative mt-2"><FieldIcon><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></FieldIcon><input type="email" autoComplete="email" required className={authInputClass} placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)}/></div></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">Senha<div className="relative mt-2"><FieldIcon>{iconLock}</FieldIcon><input type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" required minLength={6} className={authInputClass} placeholder="Mínimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)}/></div></label>
        <label className="block text-sm font-bold">Confirmar senha<div className="relative mt-2"><FieldIcon>{iconLock}</FieldIcon><input type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" required minLength={6} className={authInputClass} placeholder="Repita a senha" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}/></div></label>
      </div>
      <div className="flex items-center justify-between gap-4"><div className="flex flex-1 gap-1.5" aria-label={`Força da senha: ${forcaSenha} de 3`}>{[1,2,3].map((nivel) => <span key={nivel} className={`h-1.5 flex-1 rounded-full ${forcaSenha >= nivel ? 'bg-aco' : 'bg-linha'}`}/>)}</div><button type="button" onClick={() => setMostrarSenha((valor) => !valor)} className="text-xs font-bold text-aco">{mostrarSenha ? 'Ocultar senhas' : 'Mostrar senhas'}</button></div>
      <p className="text-xs leading-relaxed text-suave">Ao criar a conta, você terá acesso ao painel e poderá cadastrar ou importar sua carteira de clientes.</p>
      <button type="submit" disabled={carregando} className="w-full rounded-xl bg-aco py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(23,92,108,.18)] hover:bg-petroleo disabled:opacity-50">{carregando ? 'Criando conta…' : 'Criar conta'}</button>
      <p className="pt-1 text-center text-sm text-suave">Já possui conta? <Link to="/login" className="font-bold text-aco underline decoration-aco/30 underline-offset-4 hover:text-petroleo">Entrar no Farol</Link></p>
    </form>
  </AuthLayout>
}
