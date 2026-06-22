import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'comtabela_accessibility'

const defaults = {
  lowVision: false,
  colorBlind: false,
  colorBlindType: 'deuteranopia',
  vlibras: false,
  lightTheme: false,
}

// ─── Paletas colorblind-safe (baseadas na paleta de Wong, 2011) ───────────────
export const PALETTES = {
  default: {
    income:        '#10b981',
    expense:       '#ef4444',
    balance:       '#3b82f6',
    pending:       '#f59e0b',
    chartIncome:   '#10b981',
    chartExpense:  '#ef4444',
    chart: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'],
    successBg:     '#064e3b',
    successText:   '#a7f3d0',
    successBorder: '#047857',
    dangerBg:      '#7f1d1d',
    dangerText:    '#fca5a5',
    dangerBorder:  '#b91c1c',
    warningBg:     '#3d2e00',
    warningText:   '#fde68a',
    warningBorder: '#b45309',
  },

  // Protanopia — dificuldade com vermelho
  // Verde continua visível · Vermelho → Laranja dourado · Azul fica intacto
  protanopia: {
    income:       '#56B4E9',
    expense:      '#E69F00',
    balance:      '#0072B2',
    pending:      '#F0E442',
    chartIncome:  '#56B4E9',
    chartExpense: '#E69F00',
    chart: ['#56B4E9', '#E69F00', '#0072B2', '#F0E442', '#D55E00', '#CC79A7', '#009E73', '#555555'],
    successBg:     '#012d4a',
    successText:   '#90cef4',
    successBorder: '#0072B2',
    dangerBg:      '#4a2e00',
    dangerText:    '#f5d17a',
    dangerBorder:  '#E69F00',
    warningBg:     '#4a4400',
    warningText:   '#f6f09a',
    warningBorder: '#F0E442',
  },

  // Deuteranopia — dificuldade com verde (mais comum: ~8% dos homens)
  deuteranopia: {
    income:       '#56B4E9',
    expense:      '#E69F00',
    balance:      '#0072B2',
    pending:      '#F0E442',
    chartIncome:  '#56B4E9',
    chartExpense: '#E69F00',
    chart: ['#56B4E9', '#E69F00', '#0072B2', '#F0E442', '#D55E00', '#CC79A7', '#009E73', '#555555'],
    successBg:     '#012d4a',
    successText:   '#90cef4',
    successBorder: '#0072B2',
    dangerBg:      '#4a2e00',
    dangerText:    '#f5d17a',
    dangerBorder:  '#E69F00',
    warningBg:     '#4a4400',
    warningText:   '#f6f09a',
    warningBorder: '#F0E442',
  },

  // Tritanopia — dificuldade com azul
  // Azul → Vermelhão · Verde azulado visível · Roxo avermelhado para saldo
  tritanopia: {
    income:       '#009E73',
    expense:      '#D55E00',
    balance:      '#CC79A7',
    pending:      '#E69F00',
    chartIncome:  '#009E73',
    chartExpense: '#D55E00',
    chart: ['#009E73', '#D55E00', '#E69F00', '#CC79A7', '#F0E442', '#555555', '#56B4E9', '#0072B2'],
    successBg:     '#003828',
    successText:   '#6dddbd',
    successBorder: '#009E73',
    dangerBg:      '#4a2000',
    dangerText:    '#f5a87a',
    dangerBorder:  '#D55E00',
    warningBg:     '#4a2e00',
    warningText:   '#f5d17a',
    warningBorder: '#E69F00',
  },
}

// ─── Overrides das variáveis de cor do Tailwind v4 por modo ──────────────────
// Estas sobrescrevem as classes utilitárias do Tailwind (bg-blue-600, etc.)
// garantindo que TODOS os elementos coloridos se adaptem — não apenas os que
// usam variáveis semânticas --a11y-*.
const TAILWIND_COLOR_OVERRIDES = {
  default: {},

  // Para protanopia/deuteranopia:
  // Vermelho → Laranja dourado · Verde (emerald) → Azul celeste
  protanopia: {
    // Família emerald (cards de ação, botões, links verdes)
    '--color-emerald-600': '#0072B2',
    '--color-emerald-700': '#005a8e',
    '--color-emerald-500': '#56B4E9',
    '--color-emerald-400': '#56B4E9',
    '--color-emerald-100': '#cce3f5',
    '--color-emerald-200': '#90cef4',
    '--color-emerald-900': '#012d4a',
    // Família red (botão Sair mantém forma; indicadores mudam)
    '--color-red-600':  '#E69F00',
    '--color-red-700':  '#c78600',
    '--color-red-400':  '#f5d17a',
    '--color-red-200':  '#f5d17a',
    '--color-red-900':  '#4a2e00',
  },

  deuteranopia: {
    '--color-emerald-600': '#0072B2',
    '--color-emerald-700': '#005a8e',
    '--color-emerald-500': '#56B4E9',
    '--color-emerald-400': '#56B4E9',
    '--color-emerald-100': '#cce3f5',
    '--color-emerald-200': '#90cef4',
    '--color-emerald-900': '#012d4a',
    '--color-red-600':  '#E69F00',
    '--color-red-700':  '#c78600',
    '--color-red-400':  '#f5d17a',
    '--color-red-200':  '#f5d17a',
    '--color-red-900':  '#4a2e00',
  },

  // Para tritanopia: Azul → Vermelhão
  tritanopia: {
    '--color-blue-600': '#D55E00',
    '--color-blue-700': '#b84e00',
    '--color-blue-500': '#D55E00',
    '--color-blue-400': '#f5a87a',
    '--color-blue-100': '#f9d4ba',
    '--color-blue-200': '#f5a87a',
    '--color-blue-900': '#4a2000',
  },
}

// Todas as variáveis que podem ser sobrescritas (semânticas + Tailwind)
const ALL_OVERRIDE_VARS = [
  '--a11y-income', '--a11y-expense', '--a11y-balance', '--a11y-pending',
  '--a11y-success-bg', '--a11y-success-text', '--a11y-success-border',
  '--a11y-danger-bg', '--a11y-danger-text', '--a11y-danger-border',
  '--a11y-warning-bg', '--a11y-warning-text', '--a11y-warning-border',
  // Tailwind color vars
  '--color-emerald-600', '--color-emerald-700', '--color-emerald-500',
  '--color-emerald-400', '--color-emerald-100', '--color-emerald-200', '--color-emerald-900',
  '--color-red-600', '--color-red-700', '--color-red-400', '--color-red-200', '--color-red-900',
  '--color-blue-600', '--color-blue-700', '--color-blue-500',
  '--color-blue-400', '--color-blue-100', '--color-blue-200', '--color-blue-900',
]

function applyColorBlindVars(enabled, type) {
  const root = document.documentElement

  // Sempre limpa TODOS os overrides primeiro para não vazar vars do tipo anterior
  ALL_OVERRIDE_VARS.forEach(v => root.style.removeProperty(v))

  if (!enabled) return

  const p = PALETTES[type] ?? PALETTES.deuteranopia
  const tw = TAILWIND_COLOR_OVERRIDES[type] ?? {}

  // Tokens semânticos --a11y-*
  root.style.setProperty('--a11y-income',         p.income)
  root.style.setProperty('--a11y-expense',        p.expense)
  root.style.setProperty('--a11y-balance',        p.balance)
  root.style.setProperty('--a11y-pending',        p.pending)
  root.style.setProperty('--a11y-success-bg',     p.successBg)
  root.style.setProperty('--a11y-success-text',   p.successText)
  root.style.setProperty('--a11y-success-border', p.successBorder)
  root.style.setProperty('--a11y-danger-bg',      p.dangerBg)
  root.style.setProperty('--a11y-danger-text',    p.dangerText)
  root.style.setProperty('--a11y-danger-border',  p.dangerBorder)
  root.style.setProperty('--a11y-warning-bg',     p.warningBg)
  root.style.setProperty('--a11y-warning-text',   p.warningText)
  root.style.setProperty('--a11y-warning-border', p.warningBorder)

  // Variáveis de cor do Tailwind (cobre bg-blue-600, bg-emerald-600, etc.)
  Object.entries(tw).forEach(([key, val]) => root.style.setProperty(key, val))
}

// ─── VLibras ──────────────────────────────────────────────────────────────────
const VLIBRAS_CONTAINER_ID = 'vlibras-container'
const VLIBRAS_SCRIPT_ID    = 'vlibras-script'

function buildVLibrasContainer() {
  // Usa createElement + setAttribute para garantir que os atributos booleanos
  // (vw, vw-access-button, vw-plugin-wrapper) sejam reconhecidos em todos os browsers.
  const container = document.createElement('div')
  container.id = VLIBRAS_CONTAINER_ID
  container.setAttribute('vw', '')
  container.classList.add('enabled')

  const btn = document.createElement('div')
  btn.setAttribute('vw-access-button', '')
  btn.classList.add('active')

  const pluginWrapper = document.createElement('div')
  pluginWrapper.setAttribute('vw-plugin-wrapper', '')

  const topWrapper = document.createElement('div')
  topWrapper.classList.add('vw-plugin-top-wrapper')

  pluginWrapper.appendChild(topWrapper)
  container.appendChild(btn)
  container.appendChild(pluginWrapper)
  return container
}

function applyVLibras(enabled) {
  if (!enabled) {
    document.getElementById(VLIBRAS_CONTAINER_ID)?.remove()
    document.getElementById(VLIBRAS_SCRIPT_ID)?.remove()
    // Limpa a referência para que a próxima ativação reinicialize do zero
    delete window.VLibras
    return
  }

  // Evita duplicação em ativações múltiplas
  if (document.getElementById(VLIBRAS_CONTAINER_ID)) return

  document.body.appendChild(buildVLibrasContainer())

  const init = () => {
    // Pequeno delay garante que o script terminou de registrar
    // suas dependências internas antes de chamar o construtor
    setTimeout(() => {
      if (typeof window.VLibras !== 'undefined') {
        new window.VLibras.Widget('https://vlibras.gov.br/app')
      }
    }, 100)
  }

  if (typeof window.VLibras !== 'undefined') {
    init()
    return
  }

  const script = document.createElement('script')
  script.id    = VLIBRAS_SCRIPT_ID
  script.src   = 'https://vlibras.gov.br/app/vlibras-plugin.js'
  script.async = true
  script.onload  = init
  script.onerror = () => console.warn('[VLibras] falha ao carregar o script.')
  document.head.appendChild(script)
}

function applyLowVision(enabled) {
  if (enabled) {
    document.documentElement.classList.add('low-vision')
  } else {
    document.documentElement.classList.remove('low-vision')
  }
}

function applyTheme(isLight, animate = false) {
  const html = document.documentElement
  if (animate) {
    html.classList.add('theme-transitioning')
    setTimeout(() => html.classList.remove('theme-transitioning'), 300)
  }
  if (isLight) {
    html.classList.add('light-theme')
  } else {
    html.classList.remove('light-theme')
  }
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const AccessibilityContext = createContext(null)

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
    } catch {
      return defaults
    }
  })

  // Aplica estado inicial (sem animação)
  useEffect(() => {
    applyTheme(settings.lightTheme, false)
    applyColorBlindVars(settings.colorBlind, settings.colorBlindType)
    applyLowVision(settings.lowVision)
  }, [])

  // VLibras requer useEffect próprio pois injeta script externo —
  // não pode ficar dentro de setSettings (anti-pattern em StrictMode)
  useEffect(() => {
    applyVLibras(settings.vlibras)
  }, [settings.vlibras])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const toggle = (key) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'lightTheme') applyTheme(next.lightTheme, true)
      if (key === 'colorBlind') applyColorBlindVars(next.colorBlind, next.colorBlindType)
      if (key === 'lowVision')  applyLowVision(next.lowVision)
      return next
    })
  }

  const setColorBlindType = (type) => {
    setSettings((prev) => {
      const next = { ...prev, colorBlindType: type }
      if (next.colorBlind) applyColorBlindVars(true, type)
      return next
    })
  }

  const colors = PALETTES[settings.colorBlind ? settings.colorBlindType : 'default']

  return (
    <AccessibilityContext.Provider value={{ settings, toggle, setColorBlindType, colors }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) throw new Error('useAccessibility must be used inside AccessibilityProvider')
  return ctx
}
