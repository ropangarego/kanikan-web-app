type DangerConfirmModalProps = {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}

const AlertTriangleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5" aria-hidden="true">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 4.4 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z" />
  </svg>
)

export const DangerConfirmModal = ({
  open,
  title,
  message,
  detail,
  confirmLabel,
  onCancel,
  onConfirm,
}: DangerConfirmModalProps) => {
  if (!open) return null

  return (
    <div className="overlay-fade fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 md:items-center md:p-4">
      <div className="sheet-up w-full rounded-t-[18px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-strong)] md:modal-pop md:max-w-md md:rounded-[var(--radius-shell)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger-soft)] text-rose-600">
            <AlertTriangleIcon />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{message}</p>
            {detail ? <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{detail}</p> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-surface-muted)] active:scale-[0.98] md:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-[var(--radius-control)] bg-rose-600 px-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-rose-700 active:scale-[0.98] md:w-auto"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
