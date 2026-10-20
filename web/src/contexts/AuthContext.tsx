import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  usuarioPerfil: any | null
  carregando: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [usuarioPerfil, setUsuarioPerfil] = useState<any | null>(null)
  const [carregando, setCarregando] = useState(true)

  const buscarPerfil = async (userId: string) => {
    const { data } = await supabase
      .from('usuario')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setUsuarioPerfil(data)
  }

  useEffect(() => {
    // Busca a sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) buscarPerfil(session.user.id)
      setCarregando(false)
    })

    // Escuta mudanças de auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await buscarPerfil(session.user.id)
      } else {
        setUsuarioPerfil(null)
      }
      setCarregando(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, usuarioPerfil, carregando, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)