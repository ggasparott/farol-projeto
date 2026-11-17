import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MENSAGEM_SENHA, REGEX } from '../lib/validacaoCliente'
import Aviso from '../components/Aviso'
import AuthLayout, { FieldIcon, authInputClass } from '../components/AuthLayout'

// Destino do link enviado por e-mail: o Supabase abre uma sessão de recuperação e aqui a senha é trocada.
export default function RedefinirSenha() {
  const { session, carregando } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const icone = <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></>
  const erroLink = new URLSearchParams(window.location.hash.slice(1)).get('error_description')

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!REGEX.senha.test(senha)) { setErro(MENSAGEM_SENHA); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) setErro(/different from the old/i.test(error.message) ? 'A nova senha precisa ser diferente da anterior.' : error.message)
    else navigate('/', { replace: true })
  }

  return <AuthLayout>
    <div className="mb-8"><p className="rotulo mb-3">Recuperar acesso</p><h2 className="text-4xl font-extrabold tracking-[-.035em] sm:text-[2.65rem]">Criar nova senha</h2><p className="mt-3 text-lg text-suave">Escolha uma senha nova para entrar no Farol.</p></div>
    {carregando && <Aviso>Validando o link…</Aviso>}
    {!carregando && !session && <div className="space-y-5"><Aviso tipo="erro">{erroLink ? 'O link de redefinição é inválido ou expirou.' : 'Abra esta página pelo link enviado ao seu e-mail.'} Solicite um novo link para continuar.</Aviso><Link to="/esqueci-senha" className="block w-full rounded-xl bg-aco py-3.5 text-center font-bold text-white hover:bg-petroleo">Solicitar novo link</Link></div>}
    {!carregando && session && <form onSubmit={salvar} noValidate className="space-y-5">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <label className="block text-sm font-bold">Nova senha<div className="relative mt-2"><FieldIcon>{icone}</FieldIcon><input type={mostrar ? 'text' : 'password'} autoComplete="new-password" required className={authInputClass} placeholder="Mínimo 8 caracteres, letras e números" value={senha} onChange={(e) => setSenha(e.target.value)}/></div></label>
      <label className="block text-sm font-bold">Confirmar nova senha<div className="relative mt-2"><FieldIcon>{icone}</FieldIcon><input type={mostrar ? 'text' : 'password'} autoComplete="new-password" required className={authInputClass} placeholder="Repita a senha" value={confirmar} onChange={(e) => setConfirmar(e.target.value)}/></div></label>
      <button type="button" onClick={() => setMostrar((valor) => !valor)} className="text-xs font-bold text-aco">{mostrar ? 'Ocultar senhas' : 'Mostrar senhas'}</button>
      <button type="submit" disabled={salvando} className="w-full rounded-xl bg-aco py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(23,92,108,.18)] hover:bg-petroleo disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar nova senha'}</button>
    </form>}
  </AuthLayout>
}
