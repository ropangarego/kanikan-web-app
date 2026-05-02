import type { PropsWithChildren, ReactNode } from 'react'

export const PageSection = ({
  title,
  subtitle,
  action,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode }>) => (
  <section className="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
        {subtitle ? <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    {children}
  </section>
)

export const StatCard = ({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) => (
  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
    <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
    {helper ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{helper}</p> : null}
  </div>
)

export const StatusPill = ({
  children,
  tone = 'default',
}: PropsWithChildren<{ tone?: 'default' | 'warning' | 'success' | 'danger' | 'brand' }>) => {
  const tones = {
    default: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
    warning: 'bg-[var(--color-warning-soft)] text-amber-700',
    success: 'bg-[var(--color-success-soft)] text-emerald-700',
    danger: 'bg-[var(--color-danger-soft)] text-rose-700',
    brand: 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export const EmptyState = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-8 text-center">
    <p className="font-medium text-[var(--color-text)]">{title}</p>
    <p className="mt-2 text-sm text-[var(--color-text-muted)]">{description}</p>
  </div>
)

export const Table = ({ headers, rows, rowClassNames = [] }: { headers: string[]; rows: ReactNode[][]; rowClassNames?: string[] }) => (
  <div className="min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
    <div className="max-w-full overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--color-border)]">
        <thead className="bg-[var(--color-surface-muted)]">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
          {rows.map((row, index) => (
            <tr key={index} className={`align-top transition-colors duration-150 hover:bg-[var(--color-surface-muted)] ${rowClassNames[index] ?? ''}`}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-sm text-[var(--color-text)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)
