import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { translateAuthError } from '../lib/formatters'

function getPasswordStrength(pwd) {
  if (!pwd) return { score: 0, label: '', color: 'bg-slate-700' }
  let score = 0
  if (pwd.length >= 8) score += 1
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1
  if (/\d/.test(pwd)) score += 1
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1

  if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-rose-500' }
  if (score === 2) return { score: 2, label: 'Razoável', color: 'bg-amber-500' }
  if (score === 3) return { score: 3, label: 'Boa', color: 'bg-sky-500' }
  return { score: 4, label: 'Forte', color: 'bg-emerald-500' }
}

export default function Login() {
  const {
    user,
    loading: authLoading,
    recoveryMode,
    isConfigured,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    clearRecoveryMode,
  } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Entrar — ComTabela'
  }, [])

  const strength = useMemo(() => getPasswordStrength(password), [password])

  if (!authLoading && user && !recoveryMode) {
    return <Navigate to="/dashboard" replace />
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setInfoMessage('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')

    if (recoveryMode) {
      if (password.length < 8) {
        setError('A nova senha deve ter pelo menos 8 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setError('As senhas digitadas não conferem.')
        return
      }
      setSubmitting(true)
      const { error: updateErr } = await updatePassword(password)
      setSubmitting(false)

      if (updateErr) {
        setError(translateAuthError(updateErr.message))
        return
      }
      toast({ title: 'Senha atualizada com sucesso', description: 'Você já pode acessar seu painel.' })
      navigate('/dashboard', { replace: true })
      return
    }

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Informe seu e-mail para receber o link de recuperação.')
        return
      }
      setSubmitting(true)
      const { error: resetErr } = await resetPassword(email)
      setSubmitting(false)

      if (resetErr) {
        setError(translateAuthError(resetErr.message))
        return
      }
      setInfoMessage('Enviamos um link de redefinição para o seu e-mail. Verifique também a pasta de spam.')
      toast({ title: 'E-mail de recuperação enviado', variant: 'info' })
      return
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Escolha uma senha com pelo menos 8 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setError('A confirmação de senha não confere.')
        return
      }
    }

    setSubmitting(true)
    const response =
      mode === 'signup' ? await signUp(email, password) : await signIn(email, password)
    setSubmitting(false)

    if (response.error) {
      setError(translateAuthError(response.error.message))
      return
    }

    if (mode === 'signup' && !response.data?.session) {
      setInfoMessage('Conta criada! Confirme o link enviado ao seu e-mail para concluir o primeiro acesso.')
      toast({ title: 'Cadastro realizado', description: 'Confirme seu e-mail para entrar.' })
      setMode('signin')
      setPassword('')
      setConfirmPassword('')
      return
    }

    toast({ title: mode === 'signup' ? 'Conta criada com sucesso' : 'Bem-vindo de volta' })
    navigate('/dashboard', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
      <div className="w-full max-w-md surface-card p-7 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <img src="/salary.png" alt="Logo ComTabela" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 leading-none">
              ComTabela
            </h1>
            <p className="text-xs text-slate-400 mt-1">Controle financeiro pessoal e operacional</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-100">
            {recoveryMode
              ? 'Definir nova senha'
              : mode === 'signup'
                ? 'Criar nova conta'
                : mode === 'forgot'
                  ? 'Recuperar acesso'
                  : 'Entrar na sua conta'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {recoveryMode
              ? 'Escolha uma nova senha segura para proteger seus dados.'
              : mode === 'signup'
                ? 'Seus lançamentos ficam isolados com criptografia e RLS.'
                : mode === 'forgot'
                  ? 'Informe seu e-mail cadastrado para receber o link de redefinição.'
                  : 'Acompanhe receitas, despesas, metas e operações.'}
          </p>
        </div>

        {!isConfigured && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-xs text-amber-200 leading-relaxed">
            Variáveis <code className="font-mono">VITE_SUPABASE_URL</code> e{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> não detectadas em{' '}
            <code className="font-mono">.env.local</code>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!recoveryMode && (
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base w-full pl-10"
                />
              </div>
            </div>
          )}

          {(mode !== 'forgot' || recoveryMode) && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-300">
                  {recoveryMode ? 'Nova senha' : 'Senha'}
                </label>
                {mode === 'signin' && !recoveryMode && (
                  <button
                    type="button"
                    id="btn-forgot-password"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' || recoveryMode ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'signup' || recoveryMode ? 8 : 6}
                  placeholder={mode === 'signup' || recoveryMode ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base w-full pl-10 pr-10"
                />
                <button
                  type="button"
                  id="btn-toggle-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {(mode === 'signup' || recoveryMode) && password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`rounded-full transition-colors ${
                          strength.score >= step ? strength.color : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Força da senha: <span className="text-slate-200 font-medium">{strength.label}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {(mode === 'signup' || recoveryMode) && (
            <div>
              <label
                htmlFor="login-confirm-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Confirmar senha
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-base w-full pl-10"
                />
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-200 leading-relaxed"
            >
              {error}
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-200 leading-relaxed"
            >
              {infoMessage}
            </div>
          )}

          <button
            type="submit"
            id="btn-auth-submit"
            disabled={submitting || !isConfigured}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {submitting
              ? 'Processando...'
              : recoveryMode
                ? 'Salvar nova senha'
                : mode === 'signup'
                  ? 'Criar conta'
                  : mode === 'forgot'
                    ? 'Enviar link de recuperação'
                    : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-sm text-slate-400">
          {recoveryMode ? (
            <button
              type="button"
              onClick={() => {
                clearRecoveryMode()
                navigate('/dashboard')
              }}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
            >
              <ArrowLeft size={14} />
              Voltar ao painel
            </button>
          ) : mode === 'forgot' ? (
            <button
              type="button"
              id="btn-back-to-signin"
              onClick={() => switchMode('signin')}
              className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
            >
              <ArrowLeft size={15} />
              Voltar para o login
            </button>
          ) : (
            <p>
              {mode === 'signup' ? 'Já possui uma conta?' : 'Ainda não tem conta?'}{' '}
              <button
                type="button"
                id="btn-switch-auth-mode"
                onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
                className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
              >
                {mode === 'signup' ? 'Fazer login' : 'Cadastre-se'}
              </button>
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck size={13} className="text-emerald-500/80" />
          <span>Protegido com Supabase Auth & Row Level Security</span>
        </div>
      </div>
    </main>
  )
}