import PropTypes from 'prop-types'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Briefcase,
  Cloud,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Tags,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useToast } from '../contexts/ToastContext'

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth()
  const {
    privacyMode,
    togglePrivacyMode,
    operationsEnabled,
    setOperationsEnabled,
    syncing,
  } = useWorkspace()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const handleEnableOperations = () => {
    setOperationsEnabled(true)
    toast({
      title: 'Módulo Operações ativado',
      description: 'Banca, diário EV+ e estoque de revenda liberados no menu.',
    })
    navigate('/operations')
  }

  const navItems = [
    { to: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard, id: 'nav-dashboard' },
    { to: '/transactions', label: 'Transações', icon: ArrowLeftRight, id: 'nav-transactions' },
    { to: '/categories', label: 'Categorias', icon: Tags, id: 'nav-categories' },
    ...(operationsEnabled
      ? [{ to: '/operations', label: 'Operações', icon: Briefcase, id: 'nav-operations' }]
      : []),
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#080c14] text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-64 lg:w-68 shrink-0 flex-col justify-between bg-[#0c121e] border-r border-slate-800/80 p-5 sticky top-0 h-screen">
        <div>
          <div className="flex items-center justify-between px-2 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <img src="/salary.png" alt="Logo ComTabela" className="w-5 h-5 object-contain" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-100 block leading-none">
                  ComTabela
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Finanças & Capital</span>
              </div>
            </div>

            <button
              type="button"
              id="btn-privacy-desktop"
              onClick={togglePrivacyMode}
              title={privacyMode ? 'Mostrar valores monetários' : 'Ocultar valores monetários'}
              aria-label={privacyMode ? 'Mostrar valores monetários' : 'Ocultar valores monetários'}
              className="p-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
            >
              {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <nav aria-label="Navegação principal" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  id={item.id}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {!operationsEnabled && (
            <div className="mt-6 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90">
              <p className="text-xs font-semibold text-slate-200">Módulo Operações</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Separe banca EV+ e estoque de revenda das contas pessoais.
              </p>
              <button
                type="button"
                id="btn-sidebar-enable-ops"
                onClick={handleEnableOperations}
                className="mt-3 w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Ativar Operações
              </button>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="px-2 flex items-center justify-between text-xs text-slate-400">
            <span className="truncate max-w-[165px]" title={user?.email}>
              {user?.email}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[11px] text-slate-500"
              title={syncing ? 'Sincronizando dados...' : 'Dados isolados por conta'}
            >
              <Cloud size={13} className={syncing ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
            </span>
          </div>
          <button
            type="button"
            id="btn-signout-desktop"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-rose-300 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800/50 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Topbar Mobile */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0c121e]/95 backdrop-blur-md border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <img src="/salary.png" alt="Logo ComTabela" className="w-4 h-4 object-contain" />
          </div>
          <span className="font-bold text-base tracking-tight">ComTabela</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-privacy-mobile"
            onClick={togglePrivacyMode}
            aria-label={privacyMode ? 'Mostrar valores' : 'Ocultar valores'}
            className="p-2 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/70"
          >
            {privacyMode ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          <button
            type="button"
            id="btn-signout-mobile"
            onClick={handleSignOut}
            aria-label="Sair da conta"
            className="p-2 rounded-lg bg-slate-800/80 text-rose-300 border border-slate-700/70"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="flex-1 min-w-0 pb-24 md:pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">{children}</div>
      </div>

      {/* Bottom Tab Bar Mobile */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0c121e]/95 backdrop-blur-md border-t border-slate-800/90 px-2 py-1.5"
      >
        <div
          className={`grid gap-1 ${
            navItems.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                id={`${item.id}-mobile`}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[11px] font-medium transition-colors ${
                    isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <Icon size={18} className="mb-0.5" />
                <span className="truncate max-w-full">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

AppLayout.propTypes = {
  children: PropTypes.node.isRequired,
}
