import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Accessibility } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccessibility } from '../contexts/AccessibilityContext'
import ExportButton from './ExportButton'

const ACCESSIBILITY_OPTIONS = [
  {
    key: 'lowVision',
    label: 'Modo Baixa Visão',
    description: 'Aumenta contraste e tamanho dos elementos',
  },
  {
    key: 'colorBlind',
    label: 'Modo Daltonismo',
    description: 'Ajusta paleta de cores para daltonismo',
  },
  {
    key: 'lightTheme',
    label: 'Tema Claro',
    description: 'Alterna para o tema de cores claras',
  },
]

const COLORBLIND_TYPES = [
  { value: 'protanopia',   label: 'Protanopia',   hint: 'dificuldade com vermelho' },
  { value: 'deuteranopia', label: 'Deuteranopia', hint: 'dificuldade com verde' },
  { value: 'tritanopia',   label: 'Tritanopia',   hint: 'dificuldade com azul' },
]

function Switch({ checked, onChange, id }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
        checked ? 'bg-emerald-500' : 'bg-gray-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function ColorBlindTypeSelector() {
  const { settings, setColorBlindType } = useAccessibility()

  return (
    <div className="px-5 pb-4 pt-1 bg-gray-800/50 border-b border-gray-800">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Tipo de daltonismo
      </p>
      <div className="flex flex-col gap-2">
        {COLORBLIND_TYPES.map(({ value, label, hint }) => {
          const active = settings.colorBlindType === value
          return (
            <label
              key={value}
              className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                active
                  ? 'border-emerald-500 bg-emerald-900/30'
                  : 'border-gray-700 hover:bg-gray-700/40'
              }`}
            >
              <input
                type="radio"
                name="colorblind-type"
                value={value}
                checked={active}
                onChange={() => setColorBlindType(value)}
                className="mt-0.5 accent-emerald-500"
              />
              <span>
                <span className="block text-sm font-medium text-white">{label}</span>
                <span className="block text-xs text-gray-400">{hint}</span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function AccessibilityPanel({ onClose }) {
  const { settings, toggle } = useAccessibility()
  const panelRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Conta apenas os booleanos principais (exclui colorBlindType que é string)
  const activeCount = ACCESSIBILITY_OPTIONS.filter(({ key }) => settings[key]).length

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Painel de acessibilidade"
      className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl z-50 overflow-hidden"
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 bg-gray-800/60">
        <div className="flex items-center gap-2">
          <Accessibility size={18} className="text-emerald-400" />
          <span className="font-semibold text-white text-sm">Acessibilidade</span>
          {activeCount > 0 && (
            <span className="text-xs bg-emerald-500 text-white rounded-full px-2 py-0.5 font-medium">
              {activeCount} ativo{activeCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar painel"
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.854 3.146a.5.5 0 0 1 0 .708L8.707 8l4.147 4.146a.5.5 0 0 1-.708.708L8 8.707l-4.146 4.147a.5.5 0 0 1-.708-.708L7.293 8 3.146 3.854a.5.5 0 0 1 .708-.708L8 7.293l4.146-4.147a.5.5 0 0 1 .708 0z" />
          </svg>
        </button>
      </div>

      {/* Lista de opções */}
      <ul className="divide-y divide-gray-800" role="list">
        {ACCESSIBILITY_OPTIONS.map(({ key, label, description }) => {
          const switchId = `a11y-switch-${key}`
          return (
            <li key={key}>
              <div className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-800/40 transition-colors">
                <label htmlFor={switchId} className="flex-1 cursor-pointer select-none">
                  <span className="block text-sm font-medium text-white">{label}</span>
                  <span className="block text-xs text-gray-400 mt-0.5">{description}</span>
                </label>
                <Switch
                  id={switchId}
                  checked={Boolean(settings[key])}
                  onChange={() => toggle(key)}
                />
              </div>
              {/* Seletor de tipo — aparece somente quando o switch de daltonismo está ativo */}
              {key === 'colorBlind' && settings.colorBlind && <ColorBlindTypeSelector />}
            </li>
          )
        })}
      </ul>

      {/* Rodapé */}
      <div className="px-5 py-3 border-t border-gray-700 bg-gray-800/40">
        <p className="text-xs text-gray-500 text-center">
          Preferências salvas automaticamente
        </p>
      </div>
    </div>
  )
}

export default function Navbar({
  backTo = null,
  backLabel = 'Voltar ao Início',
  rightSlot = null,
  showSignOut = false,
  transactions = [],
}) {
  const { signOut } = useAuth()
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <nav className="flex justify-between items-center mb-8 relative">
      <div className="flex items-center gap-3">
        {backTo ? (
          <Link
            to={backTo}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            {backLabel}
          </Link>
        ) : (
          <h1 className="text-3xl font-bold">ComTabela 📊</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {rightSlot}
        {showSignOut && <ExportButton transactions={transactions} />}

        <div className="relative">
          <button
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            aria-label="Abrir painel de acessibilidade"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all border ${
              panelOpen
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <Accessibility size={16} />
            <span className="hidden sm:inline">Acessibilidade</span>
          </button>

          {panelOpen && <AccessibilityPanel onClose={() => setPanelOpen(false)} />}
        </div>

        {showSignOut && (
          <button
            onClick={signOut}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            Sair
          </button>
        )}
      </div>
    </nav>
  )
}

/**
 * Botão flutuante de acessibilidade — para usar em páginas sem Navbar
 * (ex.: tela de Login). Posicionado fixo no canto superior direito.
 */
export function AccessibilityFloatButton() {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setPanelOpen((o) => !o)}
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        aria-label="Abrir painel de acessibilidade"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all border shadow-lg ${
          panelOpen
            ? 'bg-emerald-600 border-emerald-500 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
      >
        <Accessibility size={16} />
        <span>Acessibilidade</span>
      </button>

      {panelOpen && (
        <AccessibilityPanel onClose={() => setPanelOpen(false)} />
      )}
    </div>
  )
}
