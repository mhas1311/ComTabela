import { createContext, useCallback, useContext, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertCircle, CheckCircle2, Info, RotateCcw, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description = '', variant = 'success', actionLabel = '', onAction = null, duration = 4500 }) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant, actionLabel, onAction }])

      if (duration > 0) {
        window.setTimeout(() => {
          dismiss(id)
        }, duration)
      }
      return id
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((item) => {
          const isError = item.variant === 'error'
          const isInfo = item.variant === 'info'
          const icon = isError ? (
            <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
          ) : isInfo ? (
            <Info size={18} className="text-sky-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
          )

          return (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto toast-enter bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-3.5 shadow-2xl flex items-start gap-3 text-slate-100"
            >
              {icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{item.title}</p>
                {item.description ? (
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>
                ) : null}
                {item.actionLabel && item.onAction ? (
                  <button
                    type="button"
                    onClick={() => {
                      item.onAction()
                      dismiss(item.id)
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    {item.actionLabel}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Fechar notificação"
                onClick={() => dismiss(item.id)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
