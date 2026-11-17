import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { REGEX } from '../lib/validacaoCliente'
import Aviso from '../components/Aviso'
import AuthLayout, { FieldIcon, authInputClass } from '../components/AuthLayout'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!REGEX.email.test(email.trim())) { setErro('Informe um e-mail válido, como voce@empresa.com.br.'); return }
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` })
    setEnviando(false)
    if (error) setErro(/rate limit/i.test(error.message) ? 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.' : error.message)
    else setEnviado(true)
  }

  return <AuthLayout>
    <div className="mb-8"><p className="rotulo mb-3">Recuperar acesso</p><h2 className="text-4xl font-extrabold tracking-[-.035em] sm:text-[2.65rem]">Esqueci minha senha</h2><p className="mt-3 text-lg text-suave">Enviaremos um link para você criar uma nova senha.</p></div>
    {enviado
      ? <div className="space-y-5"><Aviso>Se houver uma conta para <strong>{email.trim()}</strong>, você receberá um e-mail com o link de redefinição em alguns minutos. Confira também a caixa de spam.</Aviso><Link to="/login" className="block w-full rounded-xl bg-aco py-3.5 text-center font-bold text-white hover:bg-petroleo">Voltar ao login</Link></div>
      : <form onSubmit={enviar} noValidate className="space-y-5">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <label className="block text-sm font-bold">E-mail da conta<div className="relative mt-2"><FieldIcon><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></FieldIcon><input type="email" autoComplete="email" required className={authInputClass} placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)}/></div></label>
        <button type="submit" disabled={enviando} className="w-full rounded-xl bg-aco py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(23,92,108,.18)] hover:bg-petroleo disabled:opacity-50">{enviando ? 'Enviando…' : 'Enviar link de redefinição'}</button>
        <p className="pt-2 text-center text-sm text-suave">Lembrou a senha? <Link to="/login" className="font-bold text-aco underline decoration-aco/30 underline-offset-4 hover:text-petroleo">Entrar no Farol</Link></p>
      </form>}
  </AuthLayout>
}
