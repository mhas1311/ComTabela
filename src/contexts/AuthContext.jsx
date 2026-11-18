import { createContext, useContext, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return undefined
    }

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data?.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      }
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    if (!supabase) return { error: { message: 'Supabase não configurado.' } }
    return supabase.auth.signInWithPassword({ email: email.trim(), password })
  }

  const signUp = async (email, password) => {
    if (!supabase) return { error: { message: 'Supabase não configurado.' } }
    return supabase.auth.signUp({ email: email.trim(), password })
  }

  const resetPassword = async (email) => {
    if (!supabase) return { error: { message: 'Supabase não configurado.' } }
    return supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })
  }

  const updatePassword = async (newPassword) => {
    if (!supabase) return { error: { message: 'Supabase não configurado.' } }
    const response = await supabase.auth.updateUser({ password: newPassword })
    if (!response.error) setRecoveryMode(false)
    return response
  }

  const clearRecoveryMode = () => setRecoveryMode(false)

  const signOut = async () => {
    if (!supabase) return { error: null }
    setRecoveryMode(false)
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        recoveryMode,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        clearRecoveryMode,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)