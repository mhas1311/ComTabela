import PropTypes from 'prop-types'
import { Navigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import AppLayout from './AppLayout'
import { PageSkeleton } from './Skeleton'

export default function ProtectedRoute({ children }) {
  const { user, loading, isConfigured, recoveryMode } = useAuth()

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#080c14] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full surface-card p-8 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-xl font-bold">Configuração do Supabase pendente</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Defina as variáveis <code className="text-emerald-300">VITE_SUPABASE_URL</code> e{' '}
            <code className="text-emerald-300">VITE_SUPABASE_ANON_KEY</code> em um arquivo{' '}
            <code className="text-slate-200">.env.local</code> na raiz do projeto e reinicie o servidor.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-slate-100 p-6 md:p-10 max-w-6xl mx-auto">
        <PageSkeleton />
      </div>
    )
  }

  if (!user || recoveryMode) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout>{children}</AppLayout>
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
}