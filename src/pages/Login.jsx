import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { AccessibilityFloatButton } from '../components/Navbar'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password)

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <AccessibilityFloatButton />
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">ComTabela</h1>
        <p className="text-gray-400 mb-8">
          {isSignUp ? 'Crie sua conta' : 'Entre na sua conta'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Carregando...' : isSignUp ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">
          {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-emerald-400 hover:underline"
          >
            {isSignUp ? 'Faça login' : 'Cadastre-se'}
          </button>
        </p>
      </div>
    </div>
  )
}