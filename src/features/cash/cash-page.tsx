import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSearchParams } from 'react-router-dom'
import {
  createCashTransaction,
  deleteCashTransaction,
  updateCashTransaction,
  useCashCategoriesQuery,
  useCashSummaryQuery,
  useCashTransactionsQuery,
} from '../../lib/api'
import { formatDate, formatRelativeShortDate, formatRupiah } from '../../lib/format'
import { translate, useAppLanguage } from '../../lib/i18n'
import { usePersistentState } from '../../lib/local-storage'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useAppData } from '../app/app-data-context'
import { useAuth } from '../auth/auth-context'
import { StepSelector } from '../design/ui-showcase-components'
import { useToast } from '../feedback/toast-provider'
import { StatusPill } from '../shared/components'
import { DangerConfirmModal } from '../shared/danger-confirm-modal'

const schema = z.object({
  date: z.string(),
  type: z.enum(['Masuk', 'Keluar']),
  categoryId: z.string().min(1),
  description: z.string(),
  amountRp: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().positive(),
  ),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>
type ChartPoint = {
  date: string
  fullDate: string
  balance: number
  income: number
  outcome: number
  netChange: number
}

const getToday = () => new Date().toISOString().slice(0, 10)
const getMonthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const getDateFromMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

const shiftMonth = (monthKey: string, delta: number) => {
  const base = getDateFromMonthKey(monthKey)
  base.setMonth(base.getMonth() + delta)
  return getMonthKey(base)
}

const formatMonthLabel = (monthKey: string) =>
  new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(getDateFromMonthKey(monthKey))

const getMonthRange = (monthKey: string) => {
  const start = getDateFromMonthKey(monthKey)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  return {
    startKey: start.toISOString().slice(0, 10),
    endKey: end.toISOString().slice(0, 10),
    label: `${new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(start)} - ${new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
    }).format(end)}`,
  }
}

const formatCompactRupiah = (value: number) =>
  `Rp ${new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value)}`

const formatLongDate = (date: string) =>
  new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))

const formatSignedRupiah = (value: number) => {
  if (value === 0) return formatRupiah(0)
  return `${value < 0 ? '-' : '+'}${formatRupiah(Math.abs(value))}`
}

const fieldClassName =
  'w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]'

const quickDateLabelClassName = 'text-xs font-medium text-[var(--color-text-muted)]'
const quickDateClassName =
  'cursor-pointer text-xs font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-primary)] active:scale-[0.98]'

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
    <path d="M5 7h14" />
    <path d="M10 11v6M14 11v6" />
    <path d="M8 7l1-3h6l1 3" />
    <path d="M7 7l1 13h8l1-13" />
  </svg>
)

const ChartTooltip = ({
  active,
  payload,
  labels,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
  labels: { balance: string; income: string; outcome: string; net: string }
}) => {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 py-2 text-xs shadow-[var(--shadow-soft)]">
      <p className="font-semibold text-[var(--color-text)]">{point.fullDate}</p>
      <div className="mt-1 space-y-0.5 text-[var(--color-text-muted)]">
        <p>{labels.balance}: {formatRupiah(point.balance)}</p>
        <p>{labels.income}: {formatRupiah(point.income)}</p>
        <p>{labels.outcome}: {formatRupiah(point.outcome)}</p>
        <p>{labels.net}: {formatSignedRupiah(point.netChange)}</p>
      </div>
    </div>
  )
}

const initialDraft: FormInput = {
  date: getToday(),
  type: 'Keluar',
  categoryId: 'cash-cat-feed',
  description: '',
  amountRp: '',
}

const LedgerRowCard = ({
  date,
  type,
  category,
  note,
  amount,
  typeLabel,
  actionLabel,
  onOpenActions,
  canOpenActions = true,
  highlighted = false,
}: {
  date: string
  type: 'Masuk' | 'Keluar'
  category: string
  note: string
  amount: string
  typeLabel: string
  actionLabel: string
  onOpenActions: () => void
  canOpenActions?: boolean
  highlighted?: boolean
}) => (
  <button
    type="button"
    onClick={onOpenActions}
    disabled={!canOpenActions}
    className={`w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 text-left transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.99] ${highlighted ? 'new-entry-blink' : ''}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text)]">{category}</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{date}</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{note}</p>
      </div>
      <StatusPill tone={type === 'Masuk' ? 'success' : 'default'}>{typeLabel}</StatusPill>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-base font-semibold text-[var(--color-text)]">{amount}</p>
      {canOpenActions ? <span className="text-xs font-medium text-[var(--color-text-muted)]">{actionLabel}</span> : null}
    </div>
  </button>
)

export const CashPage = () => {
  const auth = useAuth()
  const appData = useAppData()
  const { showToast } = useToast()
  const isOwner = auth.profile?.role === 'owner'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = usePersistentState<FormInput>('kanikan-draft-cash', initialDraft)
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey())
  const [showForm, setShowForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [selectedActionEntryId, setSelectedActionEntryId] = useState<string | null>(null)
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null)
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null)
  const [mobileVisibleCount, setMobileVisibleCount] = useState(7)
  const [formError, setFormError] = useState<string | null>(null)
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const cashSummaryQuery = useCashSummaryQuery({ month: selectedMonth })
  const cashTransactionsQuery = useCashTransactionsQuery({ month: selectedMonth, limit: 100 })
  const cashCategoriesQuery = useCashCategoriesQuery()
  const apiCashSummary = cashSummaryQuery.data
  const apiCashTransactions = cashTransactionsQuery.data
  const apiKasCategories = cashCategoriesQuery.data?.items.map((category) => ({
    id: category.category_id,
    type: category.type,
    name: category.name,
    sortOrder: category.sort_order,
  }))
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    values: draft,
  })

  const currentMonth = getMonthKey()
  const isCurrentMonth = selectedMonth === currentMonth
  const monthRange = getMonthRange(selectedMonth)
  const kasCategories = apiKasCategories ?? appData.snapshot.kasCategories
  const cashEntries = useMemo(
    () => [...appData.snapshot.cashEntries].sort((left, right) => left.date.localeCompare(right.date)),
    [appData.snapshot.cashEntries],
  )

  useEffect(() => {
    if (searchParams.get('quick') !== 'add') return
    setShowForm(true)
    const next = new URLSearchParams(searchParams)
    next.delete('quick')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const monthEntries = useMemo(
    () => cashEntries.filter((entry) => entry.date >= monthRange.startKey && entry.date <= monthRange.endKey),
    [cashEntries, monthRange.endKey, monthRange.startKey],
  )

  const openingBalance = useMemo(
    () =>
      cashEntries
        .filter((entry) => entry.date < monthRange.startKey)
        .reduce((sum, entry) => sum + (entry.type === 'Masuk' ? entry.amountRp : -entry.amountRp), 0),
    [cashEntries, monthRange.startKey],
  )

  const localSummary = useMemo(() => {
    const income = monthEntries.filter((entry) => entry.type === 'Masuk').reduce((sum, entry) => sum + entry.amountRp, 0)
    const outcome = monthEntries.filter((entry) => entry.type === 'Keluar').reduce((sum, entry) => sum + entry.amountRp, 0)
    const net = income - outcome
    const endingBalance = openingBalance + net

    return {
      income,
      outcome,
      net,
      endingBalance,
    }
  }, [monthEntries, openingBalance])

  const apiBalancePoints = apiCashSummary?.balance_points.map((point) => ({
    date: formatRelativeShortDate(point.date),
    fullDate: formatLongDate(point.date),
    balance: point.balance_rp,
    income: point.income_rp,
    outcome: point.outcome_rp,
    netChange: point.net_rp,
  }))
  const summary = apiCashSummary
    ? {
        income: apiCashSummary.summary.income_rp,
        outcome: apiCashSummary.summary.outcome_rp,
        net: apiCashSummary.summary.net_rp,
        endingBalance: apiCashSummary.summary.ending_balance_rp,
      }
    : localSummary

  const localChartData = useMemo<ChartPoint[]>(() => {
    let runningBalance = openingBalance

    if (monthEntries.length === 0) {
      return [
        {
          date: formatRelativeShortDate(monthRange.startKey),
          fullDate: formatLongDate(monthRange.startKey),
          balance: openingBalance,
          income: 0,
          outcome: 0,
          netChange: 0,
        },
      ]
    }

    const entriesByDate = monthEntries.reduce<Record<string, { income: number; outcome: number }>>((groups, entry) => {
      const current = groups[entry.date] ?? { income: 0, outcome: 0 }
      if (entry.type === 'Masuk') {
        current.income += entry.amountRp
      } else {
        current.outcome += entry.amountRp
      }
      groups[entry.date] = current
      return groups
    }, {})

    return Object.entries(entriesByDate).map(([date, totals]) => {
      const netChange = totals.income - totals.outcome
      runningBalance += netChange
      return {
        date: formatRelativeShortDate(date),
        fullDate: formatLongDate(date),
        balance: runningBalance,
        income: totals.income,
        outcome: totals.outcome,
        netChange,
      }
    })
  }, [monthEntries, monthRange.startKey, openingBalance])
  const chartData = apiBalancePoints && apiBalancePoints.length > 0 ? apiBalancePoints : localChartData

  const syncDraft = () => setDraft(form.getValues())
  const selectedType = form.watch('type')
  const categoryOptions = kasCategories
    .filter((category) => category.type === selectedType)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const displayEntries =
    apiCashTransactions?.items.map((entry) => ({
      id: entry.transaction_id,
      date: entry.date,
      type: entry.type,
      categoryId: entry.category_id ?? '',
      categoryName: entry.category_name ?? null,
      description: entry.description,
      amountRp: entry.amount_rp,
      canDelete: isOwner || entry.can_delete,
    })) ??
    monthEntries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      type: entry.type,
      categoryId: entry.categoryId,
      categoryName: null,
      description: entry.description,
      amountRp: entry.amountRp,
      canDelete: true,
    }))
  const selectedActionEntry = selectedActionEntryId ? displayEntries.find((entry) => entry.id === selectedActionEntryId) : undefined
  const deleteEntry = deleteEntryId ? displayEntries.find((entry) => entry.id === deleteEntryId) : undefined
  const sortedDisplayEntries = displayEntries
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
  const mobileEntries = sortedDisplayEntries.slice(0, mobileVisibleCount)
  const showActionColumn = displayEntries.some((entry) => entry.canDelete)
  const getCategoryName = (categoryId: string) =>
    kasCategories.find((category) => category.id === categoryId)?.name ?? t('common.uncategorized')
  const cashTypeLabel = (type: 'Masuk' | 'Keluar') => (type === 'Masuk' ? t('cash.income') : t('cash.outcome'))
  const getCleanDraft = (): FormInput => ({
    date: getToday(),
    type: 'Keluar',
    categoryId:
      kasCategories
        .filter((category) => category.type === 'Keluar')
        .sort((left, right) => left.sortOrder - right.sortOrder)[0]?.id ?? initialDraft.categoryId,
    description: '',
    amountRp: '',
  })

  useEffect(() => {
    setMobileVisibleCount(7)
  }, [selectedMonth])

  useEffect(() => {
    if (!highlightEntryId) return
    const timeout = window.setTimeout(() => setHighlightEntryId(null), 1700)
    return () => window.clearTimeout(timeout)
  }, [highlightEntryId])

  useEffect(() => {
    const currentCategoryId = form.getValues('categoryId')
    if (!categoryOptions.some((category) => category.id === currentCategoryId) && categoryOptions[0]) {
      form.setValue('categoryId', categoryOptions[0].id)
      setDraft({ ...form.getValues(), categoryId: categoryOptions[0].id })
    }
  }, [categoryOptions, form, setDraft])

  const applyDatePreset = (preset: 'today' | 'yesterday') => {
    const baseDate = new Date()
    if (preset === 'yesterday') {
      baseDate.setDate(baseDate.getDate() - 1)
    }

    const nextValue = baseDate.toISOString().slice(0, 10)
    form.setValue('date', nextValue)
    setDraft({ ...form.getValues(), date: nextValue })
  }

  const closeForm = () => {
    const cleanDraft = getCleanDraft()
    setDraft(cleanDraft)
    form.reset(cleanDraft)
    setFormError(null)
    setShowForm(false)
    setEditingEntryId(null)
  }

  const requestDelete = (id: string) => {
    setDeleteEntryId(id)
    setSelectedActionEntryId(null)
  }

  const refreshCashQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['read-api', 'dashboard-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'cash-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'cash-transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'cash-categories'] }),
    ])
  }

  const confirmDelete = async () => {
    if (!deleteEntryId) return
    try {
      if (isSupabaseConfigured) {
        await deleteCashTransaction(deleteEntryId)
        await refreshCashQueries()
      } else if (monthEntries.some((entry) => entry.id === deleteEntryId)) {
        appData.deleteCashEntry(deleteEntryId)
      }
      showToast(t('cash.deleted'), 'success', t('cash.ledgerUpdated'))
    } catch {
      showToast(t('common.delete'), 'error', t('cash.deleteProtected'))
    }
    setDeleteEntryId(null)
    setSelectedActionEntryId(null)
  }

  const openEdit = (entryId: string) => {
    const entry = displayEntries.find((item) => item.id === entryId)
    if (!entry) return
    setEditingEntryId(entry.id)
    form.reset({
      date: entry.date,
      type: entry.type,
      categoryId: entry.categoryId || categoryOptions[0]?.id || '',
      description: entry.description ?? '',
      amountRp: String(entry.amountRp),
    })
    setDraft({
      date: entry.date,
      type: entry.type,
      categoryId: entry.categoryId || categoryOptions[0]?.id || '',
      description: entry.description ?? '',
      amountRp: String(entry.amountRp),
    })
    setSelectedActionEntryId(null)
    setShowForm(true)
  }

  const setCashType = (nextType: 'Masuk' | 'Keluar') => {
    const nextCategory = kasCategories
      .filter((category) => category.type === nextType)
      .sort((left, right) => left.sortOrder - right.sortOrder)[0]
    form.setValue('type', nextType)
    if (nextCategory) form.setValue('categoryId', nextCategory.id)
    setDraft({ ...form.getValues(), type: nextType, categoryId: nextCategory?.id ?? '' })
  }

  const submit = async (values: FormValues) => {
    try {
      if (!values.date || !values.categoryId || Number(values.amountRp || 0) <= 0) {
        setFormError(`${t('common.date')}, ${t('common.category')}, ${t('common.amount')} > 0.`)
        showToast(t('cash.validationFailed'), 'error', t('cash.checkForm'))
        return
      }
      setFormError(null)
      const input = {
        date: values.date,
        type: values.type,
        categoryId: values.categoryId,
        description: values.description,
        amountRp: values.amountRp,
        cycleId: null,
      }

      const wasEditing = Boolean(editingEntryId)
      let createdEntryId: string | null = null

      if (editingEntryId) {
        if (isSupabaseConfigured) {
          await updateCashTransaction(editingEntryId, input)
          await refreshCashQueries()
        } else {
          appData.updateCashEntry(editingEntryId, input)
        }
      } else {
        if (isSupabaseConfigured) {
          const result = await createCashTransaction(input)
          createdEntryId = result.item?.transaction_id ?? null
          await refreshCashQueries()
        } else {
          appData.addCashEntry(input)
        }
      }

      const cleanDraft = getCleanDraft()
      setDraft(cleanDraft)
      form.reset(cleanDraft)
      closeForm()
      if (createdEntryId) {
        setHighlightEntryId(createdEntryId)
      }
      showToast(wasEditing ? t('cash.updated') : t('cash.saved'), 'success', t('cash.ledgerUpdated'))
    } catch {
      showToast(t('cash.couldNotSave'), 'error', t('cash.checkConnection'))
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t('cash.title')}</h1>
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-control)] px-1 py-1 text-sm text-[var(--color-text-muted)]">
            <button
              type="button"
              onClick={() => setSelectedMonth((value) => shiftMonth(value, -1))}
              className="rounded-full px-1 text-lg leading-none text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-primary)] active:scale-95"
            >
              {'<'}
            </button>
            <span className="min-w-[120px] text-center font-semibold text-[var(--color-text)]">{formatMonthLabel(selectedMonth)}</span>
            <button
              type="button"
              disabled={selectedMonth >= currentMonth}
              onClick={() => setSelectedMonth((value) => shiftMonth(value, 1))}
              className="rounded-full px-1 text-lg leading-none text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-primary)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {'>'}
            </button>
          </div>
        </div>
      </div>

      <section className="border-t border-[var(--color-border)] pt-5">
        <div className="grid gap-6 md:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)] md:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-base font-semibold text-[var(--color-text)]">{t('cash.balanceSummary')}</h2>
              <span className="text-sm text-[var(--color-text-muted)]">
                &middot; {monthRange.label}
                {isCurrentMonth ? ` (${t('cash.thisMonth')})` : ''}
              </span>
            </div>
            <div className="max-w-md">
              <p className="text-sm text-[var(--color-text-muted)]">{t('cash.balance')}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text)]">{formatRupiah(summary.endingBalance)}</p>
              <div className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-text-muted)]">+ {t('cash.income')}</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatRupiah(summary.income)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-text-muted)]">- {t('cash.outcome')}</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatRupiah(summary.outcome)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-text-muted)]">{t('cash.net')}</span>
                  <span className={`font-semibold ${summary.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatRupiah(summary.net)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-[var(--color-border)] pt-5 md:border-l md:border-t-0 md:pl-6">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">{t('cash.balanceOverTime')}</h2>
            </div>
            <div className="h-36 sm:h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={68}
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickFormatter={(value) => formatCompactRupiah(Number(value))}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labels={{
                          balance: t('cash.chartBalance'),
                          income: t('cash.chartIn'),
                          outcome: t('cash.chartOut'),
                          net: t('cash.chartNet'),
                        }}
                      />
                    }
                    cursor={{ stroke: '#CBD5E1', strokeDasharray: '2 4' }}
                  />
                  <Line type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--color-border)] pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">{t('cash.ledger')}</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-95"
          >
            {t('cash.addTransaction')}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--color-border)]">
                  <thead className="bg-[var(--color-surface-muted)]">
                    <tr>
                      {(showActionColumn ? [t('common.date'), t('common.type'), t('common.category'), t('common.note'), t('common.amount'), t('common.actions')] : [t('common.date'), t('common.type'), t('common.category'), t('common.note'), t('common.amount')]).map((header) => (
                        <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] bg-white">
                    {sortedDisplayEntries.map((entry) => (
                        <tr key={entry.id} className={`transition-colors duration-150 hover:bg-[var(--color-surface-muted)] ${highlightEntryId === entry.id ? 'new-entry-blink' : ''}`}>
                          <td className="px-4 py-3 text-sm text-[var(--color-text)]">{formatDate(entry.date)}</td>
                          <td className="px-4 py-3">
                            <StatusPill tone={entry.type === 'Masuk' ? 'success' : 'default'}>{cashTypeLabel(entry.type)}</StatusPill>
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--color-text)]">{entry.categoryName ?? getCategoryName(entry.categoryId)}</td>
                          <td className="px-4 py-3 text-sm text-[var(--color-text)]">{entry.description || '-'}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">{formatRupiah(entry.amountRp)}</td>
                          {showActionColumn ? (
                            <td className="px-4 py-3">
                              {entry.canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedActionEntryId(entry.id)}
                                  className="inline-flex min-h-8 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-95"
                                >
                                  {t('common.actions')}
                                </button>
                              ) : (
                                <span className="text-sm text-[var(--color-text-muted)]">-</span>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {mobileEntries.map((entry) => (
                <LedgerRowCard
                  key={entry.id}
                  date={formatDate(entry.date)}
                  type={entry.type}
                  typeLabel={cashTypeLabel(entry.type)}
                  actionLabel={t('common.actions')}
                  category={entry.categoryName ?? getCategoryName(entry.categoryId)}
                  note={entry.description || '-'}
                  amount={formatRupiah(entry.amountRp)}
                  highlighted={highlightEntryId === entry.id}
                  canOpenActions={entry.canDelete}
                  onOpenActions={() => setSelectedActionEntryId(entry.id)}
                />
              ))}
            {displayEntries.length > mobileVisibleCount ? (
              <button
                type="button"
                onClick={() => setMobileVisibleCount((value) => value + 7)}
                className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98]"
              >
                {t('common.loadMore')}
              </button>
            ) : null}
          </div>

          {displayEntries.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-6 text-center">
              <p className="font-medium text-[var(--color-text)]">{t('cash.noRecords')}</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('cash.noRecordsDesc')}</p>
            </div>
          ) : null}
        </div>
      </section>

      {selectedActionEntry ? (
        <div className="overlay-fade fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-0 md:items-center md:p-4">
          <div className="sheet-up w-full rounded-t-[16px] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-strong)] md:modal-pop md:max-w-sm md:rounded-[var(--radius-shell)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[var(--color-text)]">{getCategoryName(selectedActionEntry.categoryId)}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {formatDate(selectedActionEntry.date)} &middot; {formatRupiah(selectedActionEntry.amountRp)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedActionEntryId(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-muted)] transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-95"
              >
                x
              </button>
            </div>
            <button
              type="button"
              onClick={() => openEdit(selectedActionEntry.id)}
              className="mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98]"
            >
              {t('cash.editTransaction')}
            </button>
            <button
              type="button"
              onClick={() => requestDelete(selectedActionEntry.id)}
              className="mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-rose-200 bg-[var(--color-danger-soft)] px-3 text-sm font-semibold text-rose-700 transition-all duration-150 hover:bg-rose-100 active:scale-[0.98]"
            >
              <TrashIcon />
              {t('cash.deleteTransaction')}
            </button>
          </div>
        </div>
      ) : null}

      <DangerConfirmModal
        open={Boolean(deleteEntry)}
        title={t('cash.deleteTitle')}
        message={t('cash.deleteMessage')}
        detail={
          deleteEntry
            ? `${getCategoryName(deleteEntry.categoryId)} · ${formatRupiah(deleteEntry.amountRp)}. ${t('common.cannotBeUndone')}`
            : undefined
        }
        confirmLabel={t('common.delete')}
        onCancel={() => setDeleteEntryId(null)}
        onConfirm={() => void confirmDelete()}
      />

      {showForm ? (
        <div className="overlay-fade fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-slate-950/40 p-0 md:items-center md:p-4">
          <div className="sheet-up max-h-[88vh] w-full max-w-full overflow-y-auto rounded-t-[16px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-strong)] md:modal-pop md:max-h-[90vh] md:max-w-lg md:rounded-[var(--radius-shell)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text)]">{editingEntryId ? t('cash.editTransaction') : t('cash.addTransaction')}</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{editingEntryId ? t('cash.updated') : t('cash.saved')}</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-muted)] transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-95"
              >
                x
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(submit)}>
              {formError ? <p className="rounded-[var(--radius-control)] bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
              <div className="space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('cash.typeLabel')}</span>
                <div className="grid gap-2 md:grid-cols-2">
                  <StepSelector title={t('cash.income')} description={t('cash.cashInDesc')} selected={selectedType === 'Masuk'} onClick={() => setCashType('Masuk')} />
                  <StepSelector title={t('cash.outcome')} description={t('cash.cashOutDesc')} selected={selectedType === 'Keluar'} onClick={() => setCashType('Keluar')} />
                </div>
              </div>

              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.date')}</span>
                  <input type="date" {...form.register('date', { onChange: syncDraft })} className={fieldClassName} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={quickDateLabelClassName}>{t('common.suggested')}</span>
                    <button type="button" onClick={() => applyDatePreset('today')} className={quickDateClassName}>
                      {t('common.today')}
                    </button>
                    <span className={quickDateLabelClassName}>&middot;</span>
                    <button type="button" onClick={() => applyDatePreset('yesterday')} className={quickDateClassName}>
                      {t('common.yesterday')}
                    </button>
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.category')}</span>
                  <select {...form.register('categoryId', { onChange: syncDraft })} className={fieldClassName}>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.amount')} (Rp)</span>
                <input
                  type="number"
                  min="1"
                  {...form.register('amountRp', {
                    onChange: (event) => {
                      if (Number(event.target.value) < 0) {
                        event.target.value = ''
                        form.setValue('amountRp', '')
                      }
                      syncDraft()
                    },
                  })}
                  className={fieldClassName}
                  placeholder="250000"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.note')}</span>
                <textarea
                  rows={2}
                  {...form.register('description', { onChange: syncDraft })}
                  className={`${fieldClassName} min-h-[72px] py-3`}
                  placeholder={t('common.note')}
                />
              </label>

              <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-surface-muted)] active:scale-95"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-95"
                >
                  {editingEntryId ? t('common.update') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
