import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { translate } from '../../lib/i18n'

type ToastTone = 'success' | 'error' | 'info'

type ToastItem = {
  id: string
  title?: string
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  showToast: (title: string, tone?: ToastTone, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
const createToastId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((title: string, tone: ToastTone = 'success', message?: string) => {
    const id = createToastId()
    setToasts((current) => [...current, { id, title: message ? title : undefined, message: message ?? title, tone }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3000)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-0 right-0 top-3 z-[100] flex flex-col gap-3 px-3 sm:left-auto sm:right-4 sm:w-[min(560px,calc(100vw-2rem))] sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-enter pointer-events-auto flex w-full items-start gap-4 rounded-[var(--radius-card)] border bg-white px-5 py-4 text-sm shadow-[var(--shadow-strong)] ${
              toast.tone === 'success'
                ? 'border-emerald-200 text-[var(--color-text)]'
                : toast.tone === 'error'
                  ? 'border-rose-200 text-[var(--color-text)]'
                  : 'border-sky-200 text-[var(--color-text)]'
            }`}
          >
            <span
              className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                toast.tone === 'success'
                  ? 'border-emerald-500 text-emerald-500'
                  : toast.tone === 'error'
                    ? 'border-rose-500 text-rose-500'
                    : 'border-sky-500 text-sky-500'
              }`}
              aria-hidden="true"
            >
              {toast.tone === 'success' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                  <path d="m6 12 4 4 8-8" />
                </svg>
              ) : toast.tone === 'error' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                  <path d="M12 7v6" />
                  <path d="M12 17h.01" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                  <path d="M12 17v-6" />
                  <path d="M12 7h.01" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              {toast.title ? <p className="text-lg font-semibold leading-7 text-[var(--color-text)]">{toast.title}</p> : null}
              <p className={`${toast.title ? 'mt-1 text-base text-[var(--color-text-muted)]' : 'text-lg font-semibold text-[var(--color-text)]'} leading-6`}>
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
              aria-label={translate(document.documentElement.lang, 'toast.close')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
