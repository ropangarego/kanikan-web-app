import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { StatusPill } from '../shared/components'

export type IconProps = {
  className?: string
}

type ToggleTone = 'brand' | 'success' | 'danger'

type NavItem = {
  label: string
  icon: (props: IconProps) => ReactNode
  active?: boolean
}

const buildDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const getToneClasses = (tone: ToggleTone, selected: boolean) => {
  if (!selected) {
    return 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]'
  }

  if (tone === 'success') {
    return 'border-emerald-300 bg-[var(--color-success-soft)]'
  }

  if (tone === 'danger') {
    return 'border-rose-300 bg-[var(--color-danger-soft)]'
  }

  return 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
}

export const SearchIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const CalendarIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
  </svg>
)

export const ChevronLeftIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="m15 6-6 6 6 6" />
  </svg>
)

export const ChevronRightIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)

export const ChevronDownIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const CheckIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="m5 12.5 4.2 4.2L19 7.5" />
  </svg>
)

export const HomeIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
  </svg>
)

export const PondIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 15c2.2 0 2.8-1.5 5-1.5s2.8 1.5 5 1.5 2.8-1.5 5-1.5" />
    <path d="M4 18c2.2 0 2.8-1.5 5-1.5s2.8 1.5 5 1.5 2.8-1.5 5-1.5" />
    <path d="M7 10a5 5 0 0 1 10 0" />
  </svg>
)

export const LogsIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
)

export const CashIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 7.5h16v9H4z" />
    <path d="M16 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
    <path d="M7 10h.01M17 14h.01" />
  </svg>
)

export const MoreIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 5.5h.01M12 12h.01M12 18.5h.01" />
    <circle cx="12" cy="5.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const WavesIcon = ({ className = 'h-6 w-6' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M3.5 11.5c1.4 0 1.9-1 3.3-1s1.9 1 3.3 1 1.9-1 3.3-1 1.9 1 3.3 1 1.9-1 3.3-1" />
    <path d="M3.5 16c1.4 0 1.9-1 3.3-1s1.9 1 3.3 1 1.9-1 3.3-1 1.9 1 3.3 1 1.9-1 3.3-1" />
  </svg>
)

export const WalletIcon = ({ className = 'h-6 w-6' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M5 7.5h13.5a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H5.5A2.5 2.5 0 0 1 3 15V10A2.5 2.5 0 0 1 5.5 7.5H19" />
    <path d="M15.5 12.5h4" />
    <circle cx="15.5" cy="12.5" r=".5" fill="currentColor" stroke="none" />
  </svg>
)

export const InputField = ({
  label,
  placeholder,
  helperText,
  trailing,
  onClick,
  readOnly = false,
}: {
  label: string
  placeholder?: string
  helperText?: string
  trailing?: ReactNode
  onClick?: () => void
  readOnly?: boolean
}) => (
  <label className="block space-y-2">
    <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span>
    <button
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-left text-sm text-[var(--color-text)] shadow-[var(--shadow-soft)] transition ${
        onClick ? 'hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]' : ''
      }`}
    >
      <span className={`flex-1 ${readOnly || placeholder ? 'text-[var(--color-text-muted)]' : ''}`}>{placeholder}</span>
      {trailing}
    </button>
    {helperText ? <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p> : null}
  </label>
)

export const NotesField = ({
  label,
  placeholder,
  helperText,
}: {
  label: string
  placeholder?: string
  helperText?: string
}) => (
  <label className="block space-y-2">
    <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span>
    <textarea
      rows={4}
      placeholder={placeholder}
      className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text)] outline-none shadow-[var(--shadow-soft)] transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)]"
    />
    {helperText ? <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p> : null}
  </label>
)

export const SearchField = ({ placeholder = 'Cari log, stok, arus kas...' }: { placeholder?: string }) => (
  <div className="flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 shadow-[var(--shadow-soft)]">
    <SearchIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
    <input type="text" placeholder={placeholder} className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]" />
  </div>
)

export const SearchBar = () => (
  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
    <div className="min-w-0 flex-1">
      <SearchField />
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        className="flex min-h-10 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm font-medium text-[var(--color-text)] shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)] sm:min-w-[156px]"
      >
        <span>Tipe</span>
        <ChevronDownIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
      </button>
      <button
        type="button"
        className="flex min-h-10 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm font-medium text-[var(--color-text)] shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)] sm:min-w-[156px]"
      >
        <span>Tanggal</span>
        <CalendarIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
      </button>
    </div>
  </div>
)

export const MainToggleCard = ({
  title,
  description,
  selected,
  tone = 'brand',
  onClick,
}: {
  title: string
  description: string
  selected?: boolean
  tone?: ToggleTone
  onClick?: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-[var(--radius-card)] border p-4 text-left transition ${getToneClasses(tone, Boolean(selected))}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
      </div>
      {selected ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </div>
  </button>
)

export const SegmentedCashControl = ({
  value,
  onChange,
}: {
  value: 'masuk' | 'keluar'
  onChange: (value: 'masuk' | 'keluar') => void
}) => {
  const options = useMemo(
    () => [
      { value: 'masuk' as const, label: 'Masuk' },
      { value: 'keluar' as const, label: 'Keluar' },
    ],
    [],
  )

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[var(--color-text)]">Tipe kas</p>
      <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-[calc(var(--radius-control)-2px)] px-4 py-2 text-sm font-medium transition ${
                active ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-soft)]' : 'text-[var(--color-text-muted)]'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const StepSelector = ({
  title,
  description,
  selected,
  onClick,
}: {
  title: string
  description: string
  selected?: boolean
  onClick?: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-start justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-4 text-left transition ${
      selected
        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]'
    }`}
  >
    <div>
      <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
    </div>
    {selected ? (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
    ) : null}
  </button>
)

export const LogItem = ({
  date,
  title,
  description,
}: {
  date: string
  title: string
  description: string
}) => (
  <button
    type="button"
    className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-left transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
  >
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-[var(--color-text-muted)]">{date}</span>
      <StatusPill tone="brand">Log</StatusPill>
    </div>
    <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
  </button>
)

export const StockItem = ({
  date,
  type,
  count,
  note,
}: {
  date: string
  type: string
  count: string
  note: string
}) => (
  <button
    type="button"
    className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-left transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
  >
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-[var(--color-text-muted)]">{date}</span>
      <StatusPill tone="success">{type}</StatusPill>
    </div>
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text)]">{count}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{note}</p>
      </div>
      <span className="text-xs text-[var(--color-text-muted)]">Detail</span>
    </div>
  </button>
)

export const CashItem = ({
  date,
  title,
  type,
  amount,
  category,
}: {
  date: string
  title: string
  type: 'Masuk' | 'Keluar'
  amount: string
  category?: string
}) => (
  <button
    type="button"
    className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-left transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
  >
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-[var(--color-text-muted)]">{date}</span>
      <StatusPill tone={type === 'Masuk' ? 'success' : 'default'}>{type}</StatusPill>
    </div>
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{category ?? 'Arus kas'}</p>
      </div>
      <p className="text-right text-sm font-semibold text-[var(--color-text)]">{amount}</p>
    </div>
  </button>
)

export const EmptyStateCard = ({
  icon,
  title,
  description,
  actionLabel,
  secondaryLabel,
}: {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  secondaryLabel?: string
}) => (
  <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 text-center shadow-[var(--shadow-soft)]">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
      {icon}
    </div>
    <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)]">{title}</h3>
    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
    {actionLabel || secondaryLabel ? (
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {secondaryLabel ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
          >
            {secondaryLabel}
          </button>
        ) : null}
        {actionLabel ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    ) : null}
  </div>
)

export const NoActiveCycleState = () => (
  <EmptyStateCard
    icon={<WavesIcon />}
    title="No active cycle"
    description="Start a new cycle to begin pond activity and unlock logs, stock, and cash tracking."
    actionLabel="Start Cycle"
    secondaryLabel="Learn More"
  />
)

export const NoCashRecordsState = () => (
  <EmptyStateCard
    icon={<WalletIcon />}
    title="No cash records yet"
    description="Add the first transaction to start tracking balance and cash movement for this pond."
    actionLabel="Add Cash"
  />
)

export const LoadingSummaryCard = () => (
  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
    <div className="mb-4 flex items-center gap-3 text-[var(--color-text-muted)]">
      <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-r-transparent" />
      <span className="text-sm font-medium">Loading summary...</span>
    </div>
    <div className="space-y-3">
      <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="h-8 w-24 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="h-24 animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface-muted)]" />
    </div>
  </div>
)

export const LoadingSkeleton = () => (
  <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
    <div className="grid grid-cols-4 gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-4 animate-pulse rounded bg-[var(--color-border)]" />
      ))}
    </div>
    {Array.from({ length: 3 }).map((_, rowIndex) => (
      <div key={rowIndex} className="grid grid-cols-4 gap-4 border-b border-[var(--color-border)] px-5 py-4 last:border-b-0">
        {Array.from({ length: 4 }).map((_, cellIndex) => (
          <div key={cellIndex} className="h-4 animate-pulse rounded bg-[var(--color-surface-muted)]" />
        ))}
      </div>
    ))}
  </div>
)

export const InlineCalendarGrid = ({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) => {
  const selectedDate = new Date(`${value}T00:00:00`)
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = buildDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const monthLabel = viewDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1
    return day > 0 && day <= daysInMonth ? day : null
  })

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeftIcon />
        </button>
        <div className="text-sm font-semibold capitalize text-[var(--color-text)]">{monthLabel}</div>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
          aria-label="Bulan berikutnya"
        >
          <ChevronRightIcon />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-[var(--color-text-muted)]">
        {['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={index} className="h-10" />

          const dateValue = buildDateKey(year, month, day)
          const active = dateValue === value
          const isToday = dateValue === today

          return (
            <button
              key={dateValue}
              type="button"
              onClick={() => onChange(dateValue)}
              className={`h-10 rounded-[var(--radius-control)] text-sm font-medium transition ${
                active
                  ? 'bg-[var(--color-primary)] text-white'
                  : isToday
                    ? 'border border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const CalendarModal = ({
  open,
  title,
  value,
  onClose,
  onChange,
  onConfirm,
}: {
  open: boolean
  title: string
  value: string
  onClose: () => void
  onChange: (value: string) => void
  onConfirm: () => void
}) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 pt-10">
      <div className="w-full max-w-md rounded-[var(--radius-shell)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-strong)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-[var(--color-text)]">{title}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Pilih tanggal dari kalender.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="space-y-4">
          <InlineCalendarGrid value={value} onChange={onChange} />
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">Tanggal terpilih</p>
            <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm font-medium text-[var(--color-text)]">
              <CalendarIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
              <span>{value}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white"
            >
              Gunakan tanggal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const MobileBottomNav = ({ items }: { items?: NavItem[] }) => {
  const defaultItems = useMemo<NavItem[]>(
    () => [
      { label: 'Beranda', icon: HomeIcon },
      { label: 'Kolam', icon: PondIcon, active: true },
      { label: 'Log', icon: LogsIcon },
      { label: 'Kas', icon: CashIcon },
      { label: 'Lainnya', icon: MoreIcon },
    ],
    [],
  )

  const navItems = items ?? defaultItems

  return (
    <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.label} type="button" className="flex flex-col items-center gap-1 text-center">
              <div className={`flex h-10 w-10 items-center justify-center ${item.active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-[11px] font-medium ${item.active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-[#0f172a]" />
    </div>
  )
}
