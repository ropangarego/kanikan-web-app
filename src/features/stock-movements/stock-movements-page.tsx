import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { createStockMovement, deleteStockMovement, usePondsListQuery, useStockMovementsQuery } from '../../lib/api'
import { formatDate, formatNumber, formatWeightPerFish } from '../../lib/format'
import { translate, useAppLanguage } from '../../lib/i18n'
import { usePersistentState } from '../../lib/local-storage'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getCycleMovementTotals, getLatestSampleWeight, getMovementDelta } from '../../lib/stock'
import { useAppData } from '../app/app-data-context'
import { useAuth } from '../auth/auth-context'
import { useToast } from '../feedback/toast-provider'
import { StatusPill, Table } from '../shared/components'
import { DangerConfirmModal } from '../shared/danger-confirm-modal'

type StockFilter = 'all' | 'in' | 'sold' | 'died' | 'transfer'
type UiMovementType = 'in' | 'sold' | 'died' | 'transfer' | 'adjustment'
type PeriodFilter = 'today' | '7d' | '30d' | 'month' | '3m' | 'all'

const fieldClassName =
  'w-full min-w-0 max-w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-base text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] md:text-sm'

const chipClassName = (active: boolean) =>
  `inline-flex min-h-9 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border px-2.5 text-[13px] font-semibold transition ${
    active
      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
      : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
  }`

const movementTypeOptions: Array<{ value: UiMovementType; label: string }> = [
  { value: 'in', label: 'In' },
  { value: 'sold', label: 'Sold' },
  { value: 'died', label: 'Died' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'adjustment', label: 'Adjustment' },
]

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: '3m', label: 'Last 3 months' },
  { value: 'all', label: 'All time' },
]

const schema = z.object({
  date: z.string(),
  unitId: z.string().min(1),
  toUnitId: z.string().optional(),
  uiType: z.enum(['in', 'sold', 'died', 'transfer', 'adjustment']),
  adjustmentDirection: z.enum(['in', 'out']),
  quantityMode: z.enum(['count', 'weight']),
  count: z.preprocess((value) => (value === '' || value === undefined ? undefined : Number(value)), z.number().nonnegative().optional()),
  weightKg: z.preprocess((value) => (value === '' || value === undefined ? undefined : Number(value)), z.number().nonnegative().optional()),
  description: z.string(),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

const initialDraft: FormInput = {
  date: new Date().toISOString().slice(0, 10),
  unitId: 'pond-1',
  toUnitId: '',
  uiType: 'in',
  adjustmentDirection: 'out',
  quantityMode: 'count',
  count: '',
  weightKg: '',
  description: '',
}

const movementTypeLabel = (type: string) => {
  switch (type) {
    case 'stock_in':
      return 'In'
    case 'sold':
      return 'Sold'
    case 'died':
      return 'Died'
    case 'transfer_in':
    case 'transfer_out':
      return 'Transfer'
    case 'adjustment_in':
    case 'adjustment_out':
      return 'Adjustment'
    case 'personal_use':
      return 'Adjustment'
    default:
      return type
  }
}

const matchesFilter = (movementType: string, filter: StockFilter) => {
  if (filter === 'all') return true
  if (filter === 'in') return movementType === 'stock_in'
  if (filter === 'sold') return movementType === 'sold'
  if (filter === 'died') return movementType === 'died'
  return movementType === 'transfer_in' || movementType === 'transfer_out'
}

const getPeriodRange = (filter: PeriodFilter) => {
  const end = new Date()
  const start = new Date()

  switch (filter) {
    case 'today':
      return { start: end.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
    case '7d':
      start.setDate(end.getDate() - 6)
      break
    case '30d':
      start.setDate(end.getDate() - 29)
      break
    case 'month':
      start.setDate(1)
      break
    case '3m':
      start.setMonth(end.getMonth() - 3)
      break
    case 'all':
      return null
  }

  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

const quickDateLabelClassName = 'text-xs font-medium text-[var(--color-text-muted)]'
const quickDateClassName =
  'cursor-pointer text-xs font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-primary)] active:scale-[0.98]'

const getPondSortRank = (pond: { hasCycle: boolean }) => (pond.hasCycle ? 0 : 1)

const LedgerRowCard = ({
  title,
  subtitle,
  count,
  deleteLabel,
  onDelete,
  canDelete = true,
  highlighted = false,
}: {
  title: string
  subtitle: string
  count: string
  deleteLabel: string
  onDelete: () => void
  canDelete?: boolean
  highlighted?: boolean
}) => (
  <div className={`rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 transition-all duration-150 hover:bg-[var(--color-surface-muted)] active:scale-[0.99] ${highlighted ? 'new-entry-blink' : ''}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
      </div>
      <p className="text-sm font-semibold text-[var(--color-text)]">{count}</p>
    </div>
    {canDelete ? (
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onDelete} className="cursor-pointer text-sm font-medium text-rose-600 transition-colors duration-150 hover:text-rose-700">
          {deleteLabel}
        </button>
      </div>
    ) : null}
  </div>
)

export const StockMovementsPage = () => {
  const auth = useAuth()
  const appData = useAppData()
  const { showToast } = useToast()
  const isOwner = auth.profile?.role === 'owner'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = usePersistentState<FormInput>('kanikan-draft-stock-movement', initialDraft)
  const [showForm, setShowForm] = useState(false)
  const [period, setPeriod] = useState<PeriodFilter>('30d')
  const [typeFilter, setTypeFilter] = useState<StockFilter>('all')
  const [selectedPondFilter, setSelectedPondFilter] = useState(searchParams.get('pond') ?? 'all')
  const [showPondSelector, setShowPondSelector] = useState(false)
  const [deleteMovementId, setDeleteMovementId] = useState<string | null>(null)
  const [highlightMovementId, setHighlightMovementId] = useState<string | null>(null)
  const [mobileVisibleCount, setMobileVisibleCount] = useState(7)
  const [formError, setFormError] = useState<string | null>(null)
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const stockQuery = useStockMovementsQuery({
    period,
    pond_id: selectedPondFilter,
    type: typeFilter,
    limit: 100,
  })
  const pondsListQuery = usePondsListQuery({ include_inactive: true })
  const apiStock = stockQuery.data
  const movementLabel = (type: string) => {
    switch (movementTypeLabel(type)) {
      case 'In':
        return t('stock.typeIn')
      case 'Sold':
        return t('stock.typeSold')
      case 'Died':
        return t('stock.typeDied')
      case 'Transfer':
        return t('stock.typeTransfer')
      case 'Adjustment':
        return t('stock.typeAdjustment')
      default:
        return type
    }
  }
  const periodLabel = (value: PeriodFilter) => {
    switch (value) {
      case 'today':
        return t('stock.period.today')
      case '7d':
        return t('stock.period.7d')
      case '30d':
        return t('stock.period.30d')
      case 'month':
        return t('stock.period.month')
      case '3m':
        return t('stock.period.3m')
      case 'all':
        return t('stock.period.all')
    }
  }
  const uiMovementLabel = (value: UiMovementType) => {
    switch (value) {
      case 'in':
        return t('stock.typeIn')
      case 'sold':
        return t('stock.typeSold')
      case 'died':
        return t('stock.typeDied')
      case 'transfer':
        return t('stock.typeTransfer')
      case 'adjustment':
        return t('stock.typeAdjustment')
    }
  }

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    values: draft,
  })

  useEffect(() => {
    if (searchParams.get('quick') !== 'update') return
    setShowForm(true)
    const next = new URLSearchParams(searchParams)
    next.delete('quick')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const movements = useMemo(
    () => [...appData.snapshot.stockMovements].sort((left, right) => right.date.localeCompare(left.date)),
    [appData.snapshot.stockMovements],
  )

  const periodRange = getPeriodRange(period)
  const filteredMovements = movements.filter((movement) => {
    if (periodRange && (movement.date < periodRange.start || movement.date > periodRange.end)) return false
    if (selectedPondFilter !== 'all' && movement.unitId !== selectedPondFilter) return false
    return matchesFilter(movement.movementType, typeFilter)
  })
  const ledgerRows =
    apiStock?.items.map((movement) => ({
      id: movement.movement_id,
      date: movement.date,
      type: movement.movement_type,
      pondName: movement.pond_name,
      fishSpecies: movement.fish_species ?? '-',
      countText: `${movement.direction === 'in' ? '+' : '-'}${formatNumber(movement.count)} ${t('common.fish')}`,
      canDelete: isOwner || movement.can_delete,
    })) ??
    filteredMovements.map((movement) => ({
      id: movement.id,
      date: movement.date,
      type: movement.movementType,
      pondName: appData.snapshot.ponds.find((pond) => pond.id === movement.unitId)?.name ?? movement.unitId,
      fishSpecies: movement.fishType,
      countText: `${getMovementDelta(movement.movementType, movement.count) > 0 ? '+' : '-'}${formatNumber(movement.count)} ${t('common.fish')}`,
      canDelete: true,
    }))
  const deleteMovement = deleteMovementId ? ledgerRows.find((movement) => movement.id === deleteMovementId) : undefined
  const visibleMobileMovements = ledgerRows.slice(0, mobileVisibleCount)
  const showActionColumn = ledgerRows.some((movement) => movement.canDelete)
  const pondFilterOptions =
    apiStock?.filters.ponds ??
    [
      { pond_id: 'all' as const, pond_name: t('stock.allPonds') },
      ...appData.snapshot.ponds.map((pond) => ({ pond_id: pond.id, pond_name: pond.name })),
    ]
  const selectedPondFilterName = pondFilterOptions.find((pond) => pond.pond_id === selectedPondFilter)?.pond_name ?? t('stock.choosePond')
  const formPondOptions = (
    pondsListQuery.data?.ponds.map((pond) => ({
      id: pond.pond_id,
      name: pond.pond_name,
      hasCycle: Boolean(pond.current_cycle),
      cycleId: pond.current_cycle?.cycle_id ?? null,
      fishType: pond.current_cycle?.fish_species ?? null,
    })) ??
    appData.snapshot.ponds.map((pond) => {
      const cycle = appData.getCurrentCycleForPond(pond.id)
      return {
        id: pond.id,
        name: pond.name,
        hasCycle: Boolean(cycle),
        cycleId: cycle?.id ?? null,
        fishType: cycle?.fishType ?? null,
      }
    })
  )
    .slice()
    .sort((left, right) => getPondSortRank(left) - getPondSortRank(right) || left.name.localeCompare(right.name))

  useEffect(() => {
    setMobileVisibleCount(7)
  }, [period, typeFilter, selectedPondFilter])

  useEffect(() => {
    if (!highlightMovementId) return
    const timeout = window.setTimeout(() => setHighlightMovementId(null), 1700)
    return () => window.clearTimeout(timeout)
  }, [highlightMovementId])

  const pondCards = apiStock
    ? apiStock.pond_cards.map((pond) => ({
        id: pond.pond_id,
        name: pond.pond_name,
        subtitle: pond.status === 'active' && pond.current_stock_count > 0 ? pond.fish_species ?? t('common.status.active') : t('common.empty'),
        liveText: `${formatNumber(pond.current_stock_count)} ${t('common.fish')}`,
        detail:
          pond.biomass_kg !== null && pond.biomass_kg !== undefined && pond.avg_weight_g !== null && pond.avg_weight_g !== undefined
            ? `${formatNumber(Number(pond.biomass_kg.toFixed(1)))} kg | ${formatWeightPerFish(pond.avg_weight_g, t('common.fish'))}`
            : t('stock.noBiomass'),
        isActive: pond.status === 'active' && pond.current_stock_count > 0,
      }))
    : appData.snapshot.ponds.map((pond) => {
    const cycle = appData.getCurrentCycleForPond(pond.id)
    const live = cycle ? Math.max(getCycleMovementTotals(cycle.id, appData.snapshot.stockMovements).alive, 0) : 0
    const avgWeightG = cycle ? getLatestSampleWeight(cycle.id, appData.snapshot.dailyLogs) : null
    const biomassKg = avgWeightG ? (live * avgWeightG) / 1000 : null

    return {
      id: pond.id,
      name: pond.name,
      subtitle: cycle && live > 0 ? cycle.fishType : t('common.empty'),
      liveText: cycle ? `${formatNumber(live)} ${t('common.fish')}` : '-',
      detail:
        cycle && biomassKg !== null && avgWeightG !== null
          ? `${formatNumber(Number(biomassKg.toFixed(1)))} kg | ${formatWeightPerFish(avgWeightG, t('common.fish'))}`
          : t('stock.noBiomass'),
      isActive: Boolean(cycle && live > 0),
    }
  })

  const selectedPondId = form.watch('unitId')
  const selectedUiType = form.watch('uiType')
  const quantityMode = form.watch('quantityMode')
  const selectedPondOption = formPondOptions.find((pond) => pond.id === selectedPondId)
  const selectedLocalCycle = appData.getCurrentCycleForPond(selectedPondId)
  const selectedPondCycle = selectedLocalCycle
    ? { id: selectedLocalCycle.id, fishType: selectedLocalCycle.fishType }
    : selectedPondOption?.hasCycle && selectedPondOption.cycleId && selectedPondOption.fishType
      ? { id: selectedPondOption.cycleId, fishType: selectedPondOption.fishType }
      : undefined
  const selectedAvgWeight = selectedLocalCycle ? getLatestSampleWeight(selectedLocalCycle.id, appData.snapshot.dailyLogs) : null
  const targetPondId = form.watch('toUnitId')
  const targetPondOption = formPondOptions.find((pond) => pond.id === targetPondId)
  const targetLocalCycle = targetPondId ? appData.getCurrentCycleForPond(targetPondId) : undefined
  const targetCycle = targetLocalCycle
    ? { id: targetLocalCycle.id, fishType: targetLocalCycle.fishType }
    : targetPondOption?.hasCycle && targetPondOption.cycleId && targetPondOption.fishType
      ? { id: targetPondOption.cycleId, fishType: targetPondOption.fishType }
      : undefined

  const estimatedValues = useMemo(() => {
    const count = Number(form.watch('count') || 0)
    const weightKg = Number(form.watch('weightKg') || 0)

    if (!selectedAvgWeight || selectedAvgWeight <= 0) {
      return {
        helper: t('stock.noAvgWeight'),
        estWeightKg: null,
        estCount: null,
      }
    }

    if (quantityMode === 'count' && count > 0) {
      return {
        helper: `${t('stock.basedOnAvg')}: ${formatNumber(selectedAvgWeight)}g/${t('common.fish')}`,
        estWeightKg: (count * selectedAvgWeight) / 1000,
        estCount: count,
      }
    }

    if (quantityMode === 'weight' && weightKg > 0) {
      return {
        helper: `${t('stock.basedOnAvg')}: ${formatNumber(selectedAvgWeight)}g/${t('common.fish')}`,
        estWeightKg: weightKg,
        estCount: Math.round((weightKg * 1000) / selectedAvgWeight),
      }
    }

    return {
      helper: `${t('stock.basedOnAvg')}: ${formatNumber(selectedAvgWeight)}g/${t('common.fish')}`,
      estWeightKg: null,
      estCount: null,
    }
  }, [form, quantityMode, selectedAvgWeight])

  const applyDatePreset = (preset: 'today' | 'yesterday') => {
    const baseDate = new Date()
    if (preset === 'yesterday') {
      baseDate.setDate(baseDate.getDate() - 1)
    }

    const nextValue = baseDate.toISOString().slice(0, 10)
    form.setValue('date', nextValue)
    setDraft({ ...form.getValues(), date: nextValue })
  }

  const syncDraft = () => setDraft(form.getValues())

  const requestDelete = (id: string) => {
    setDeleteMovementId(id)
  }

  const refreshStockQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['read-api', 'dashboard-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'ponds-list'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'pond-detail'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'stock-movements'] }),
    ])
  }

  const confirmDelete = async () => {
    if (!deleteMovementId) return
    try {
      if (isSupabaseConfigured) {
        await deleteStockMovement(deleteMovementId)
        await refreshStockQueries()
      } else {
        appData.deleteStockMovement(deleteMovementId)
      }
      setDeleteMovementId(null)
      showToast(t('stock.deleted'), 'success', t('stock.refreshNote'))
    } catch {
      showToast(t('common.delete'), 'error', t('stock.generatedProtected'))
    }
  }

  const saveMovement = async (values: FormValues) => {
    try {
      if (!values.date || Number(values.count || 0) < 0 || Number(values.weightKg || 0) < 0) {
        setFormError(t('quick.dateAndNonNegative'))
        showToast(t('common.validationFailed'), 'error', t('stock.formCheck'))
        return
      }
      if (values.quantityMode === 'count' && Number(values.count || 0) <= 0) {
        setFormError(t('stock.countPositive'))
        showToast(t('common.validationFailed'), 'error', t('stock.countPositive'))
        return
      }
      if (values.quantityMode === 'weight' && Number(values.weightKg || 0) <= 0) {
        setFormError(t('stock.weightPositive'))
        showToast(t('common.validationFailed'), 'error', t('stock.weightPositive'))
        return
      }
      setFormError(null)
      const sourceCycle = appData.getCurrentCycleForPond(values.unitId)
      if (!sourceCycle && !selectedPondCycle) throw new Error('No cycle')

      const computedCount =
        values.quantityMode === 'count'
          ? values.count ?? 0
          : estimatedValues.estCount ?? 0
      const computedWeight =
        values.quantityMode === 'weight'
          ? values.weightKg ?? null
          : estimatedValues.estWeightKg ?? null

      if (isSupabaseConfigured) {
        const movementType =
          values.uiType === 'in'
            ? 'stock_in'
            : values.uiType === 'sold'
              ? 'sold'
              : values.uiType === 'died'
                ? 'died'
                : values.uiType === 'transfer'
                  ? 'transfer_out'
                  : values.adjustmentDirection === 'in'
                    ? 'adjustment_in'
                    : 'adjustment_out'

        const result = await createStockMovement({
          date: values.date,
          unitId: values.unitId,
          movementType,
          count: computedCount,
          weightKg: computedWeight,
          description: values.description,
          toUnitId: values.uiType === 'transfer' ? values.toUnitId ?? null : null,
        })
        setHighlightMovementId(result.item?.movement_id ?? null)
        await refreshStockQueries()
      } else if (values.uiType === 'transfer') {
        if (!values.toUnitId || values.toUnitId === values.unitId || !targetCycle) throw new Error('Invalid transfer')

        appData.addStockMovement({
          date: values.date,
          unitId: values.unitId,
          cycleId: selectedPondCycle?.id ?? sourceCycle?.id ?? '',
          fishType: selectedPondCycle?.fishType ?? sourceCycle?.fishType ?? '',
          movementType: 'transfer_out',
          count: computedCount,
          weightKg: computedWeight,
          description: values.description,
        })

        appData.addStockMovement({
          date: values.date,
          unitId: values.toUnitId,
          cycleId: targetCycle.id,
          fishType: targetCycle.fishType,
          movementType: 'transfer_in',
          count: computedCount,
          weightKg: computedWeight,
          description: values.description,
        })
      } else {
        const movementType =
          values.uiType === 'in'
            ? 'stock_in'
            : values.uiType === 'sold'
              ? 'sold'
              : values.uiType === 'died'
                ? 'died'
                : values.adjustmentDirection === 'in'
                  ? 'adjustment_in'
                  : 'adjustment_out'

        appData.addStockMovement({
          date: values.date,
          unitId: values.unitId,
          cycleId: selectedPondCycle?.id ?? sourceCycle?.id ?? '',
          fishType: selectedPondCycle?.fishType ?? sourceCycle?.fishType ?? '',
          movementType,
          count: computedCount,
          weightKg: computedWeight,
          description: values.description,
        })
      }

      const nextDraft: FormInput = {
        ...values,
        count: '',
        weightKg: '',
        description: '',
      }
      setDraft(nextDraft)
      form.reset(nextDraft)
      setShowForm(false)
      showToast(t('stock.updated'), 'success', t('stock.refreshNote'))
    } catch {
      showToast(t('cash.couldNotSave'), 'error', t('cash.checkConnection'))
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t('stock.title')}</h1>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {pondCards.map((pond) => (
          <div
            key={pond.id}
            className={`rounded-[var(--radius-card)] border border-[var(--color-border)] border-l-4 bg-white p-2.5 transition-all duration-150 hover:bg-[var(--color-surface-muted)] hover:shadow-[var(--shadow-soft)] active:scale-[0.99] ${
              pond.isActive ? 'border-l-[var(--color-primary)]' : 'border-l-[var(--color-border-strong)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{pond.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{pond.subtitle}</p>
              </div>
              <StatusPill tone={pond.isActive ? 'brand' : 'default'}>{pond.isActive ? t('common.status.active') : t('common.status.inactive')}</StatusPill>
            </div>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{pond.liveText}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{pond.detail}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-[var(--color-border)] pt-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">{t('stock.ledger')}</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-95"
          >
            + {t('stock.updateStock')}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)} className={`${fieldClassName} cursor-pointer md:w-44`}>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {periodLabel(option.value)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowPondSelector(true)}
                className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 text-sm font-medium text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98] md:w-44"
              >
                {selectedPondFilter === 'all'
                  ? t('stock.allPonds')
                  : selectedPondFilterName}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5 md:flex md:flex-wrap md:justify-end">
              {[
                { value: 'all' as const, label: t('common.all') },
                { value: 'in' as const, label: t('stock.typeIn') },
                { value: 'sold' as const, label: t('stock.typeSold') },
                { value: 'died' as const, label: t('stock.typeDied') },
                { value: 'transfer' as const, label: t('stock.typeTransfer') },
              ].map((option) => (
                <button key={option.value} type="button" onClick={() => setTypeFilter(option.value)} className={`${chipClassName(typeFilter === option.value)} active:scale-[0.98]`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden md:block">
            {ledgerRows.length > 0 ? (
            <Table
              headers={showActionColumn ? [t('common.date'), t('common.type'), t('dashboard.pond'), t('stock.count'), t('common.actions')] : [t('common.date'), t('common.type'), t('dashboard.pond'), t('stock.count')]}
              rowClassNames={ledgerRows.map((movement) => (movement.id === highlightMovementId ? 'new-entry-blink' : ''))}
              rows={ledgerRows.map((movement) => [
                <span key={`${movement.id}-date`} className="text-sm text-[var(--color-text-muted)]">
                  {formatDate(movement.date)}
                </span>,
                <StatusPill
                  key={`${movement.id}-type`}
                  tone={
                    movement.type === 'died'
                      ? 'danger'
                      : movement.type === 'stock_in'
                        ? 'success'
                        : movement.type === 'sold'
                          ? 'brand'
                          : 'default'
                  }
                >
                  {movementLabel(movement.type)}
                </StatusPill>,
                movement.pondName,
                movement.countText,
                ...(showActionColumn
                  ? [
                      movement.canDelete ? (
                        <button key="delete" type="button" onClick={() => requestDelete(movement.id)} className="cursor-pointer text-sm font-medium text-rose-600 transition-colors duration-150 hover:text-rose-700">
                          {t('common.delete')}
                        </button>
                      ) : (
                        <span key="no-action" className="text-sm text-[var(--color-text-muted)]">-</span>
                      ),
                    ]
                  : []),
              ])}
            />
            ) : (
              <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-6 text-center">
                <p className="font-medium text-[var(--color-text)]">{t('stock.noMovements')}</p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('stock.noMovementsDesc')}</p>
              </div>
            )}
          </div>

          <div className="space-y-3 md:hidden">
            {visibleMobileMovements.map((movement) => (
              <LedgerRowCard
                key={movement.id}
                highlighted={movement.id === highlightMovementId}
                title={`${formatDate(movement.date)} | ${movementLabel(movement.type)}`}
                subtitle={movement.pondName}
                count={movement.countText}
                deleteLabel={t('common.delete')}
                canDelete={movement.canDelete}
                onDelete={() => requestDelete(movement.id)}
              />
            ))}
            {ledgerRows.length > mobileVisibleCount ? (
              <button
                type="button"
                onClick={() => setMobileVisibleCount((value) => value + 7)}
                className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98]"
              >
                {t('common.loadMore')}
              </button>
            ) : null}
            {ledgerRows.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-6 text-center">
                <p className="font-medium text-[var(--color-text)]">{t('stock.noMovements')}</p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('stock.noMovementsDesc')}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {showPondSelector ? (
        <div className="overlay-fade fixed inset-0 z-30 flex items-end bg-slate-950/30 p-0 md:items-start md:justify-center md:bg-transparent md:p-0">
          <div className="sheet-up w-full rounded-t-[16px] border border-[var(--color-border)] bg-white p-4 pb-8 shadow-[var(--shadow-strong)] md:modal-pop md:mt-[220px] md:max-w-sm md:rounded-[var(--radius-shell)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-[var(--color-text)]">{t('stock.choosePond')}</h3>
              <button type="button" onClick={() => setShowPondSelector(false)} className="text-sm text-[var(--color-text-muted)]">
                {t('common.close')}
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPondFilter('all')
                  setShowPondSelector(false)
                }}
                className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2.5 text-left text-sm font-medium text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98]"
              >
                {t('stock.allPonds')}
              </button>
              {pondFilterOptions
                .filter((pond) => pond.pond_id !== 'all')
                .map((pond) => (
                <button
                  key={pond.pond_id}
                  type="button"
                  onClick={() => {
                    setSelectedPondFilter(pond.pond_id)
                    setShowPondSelector(false)
                  }}
                  className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2.5 text-left text-sm font-medium text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98]"
                >
                  {pond.pond_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <DangerConfirmModal
        open={Boolean(deleteMovement)}
        title={t('stock.deleted')}
        message={t('stock.generatedProtected')}
        detail={
          deleteMovement
            ? `${t('dashboard.pond')}: ${deleteMovement.pondName} - ${deleteMovement.fishSpecies}. ${t('common.date')}: ${formatDate(deleteMovement.date)}. ${t('common.type')}: ${movementLabel(deleteMovement.type)}. ${t('stock.count')}: ${deleteMovement.countText}.`
            : undefined
        }
        confirmLabel={t('common.delete')}
        onCancel={() => setDeleteMovementId(null)}
        onConfirm={() => void confirmDelete()}
      />

      {showForm ? (
        <div className="overlay-fade fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-slate-950/40 p-0 md:items-center md:p-4">
          <div className="sheet-up max-h-[88vh] w-full overflow-y-auto rounded-t-[16px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-strong)] md:modal-pop md:max-h-[90vh] md:max-w-md md:rounded-[var(--radius-shell)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text)]">{t('stock.updateStock')}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-muted)] transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-95"
              >
                x
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(saveMovement)}>
              {formError ? <p className="rounded-[var(--radius-control)] bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
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
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('dashboard.pond')}</span>
                <select {...form.register('unitId', { onChange: syncDraft })} className={fieldClassName}>
                  {formPondOptions.map((pond) => (
                    <option key={pond.id} value={pond.id}>
                      {pond.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.type')}</span>
                <div className="flex flex-wrap gap-2">
                  {movementTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        form.setValue('uiType', option.value)
                        setDraft({ ...form.getValues(), uiType: option.value })
                      }}
                      className={`${chipClassName(selectedUiType === option.value)} active:scale-[0.98]`}
                    >
                      {uiMovementLabel(option.value)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedUiType === 'transfer' ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.toPond')}</span>
                  <select {...form.register('toUnitId', { onChange: syncDraft })} className={fieldClassName}>
                    <option value="">{t('stock.choosePond')}</option>
                    {formPondOptions
                      .filter((pond) => pond.id !== selectedPondId)
                      .map((pond) => (
                        <option key={pond.id} value={pond.id}>
                          {pond.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}

              {selectedUiType === 'adjustment' ? (
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.adjustmentType')}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue('adjustmentDirection', 'in')
                        setDraft({ ...form.getValues(), adjustmentDirection: 'in' })
                      }}
                      className={`${chipClassName(form.watch('adjustmentDirection') === 'in')} active:scale-[0.98]`}
                    >
                      {t('stock.adjustmentIn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue('adjustmentDirection', 'out')
                        setDraft({ ...form.getValues(), adjustmentDirection: 'out' })
                      }}
                      className={`${chipClassName(form.watch('adjustmentDirection') === 'out')} active:scale-[0.98]`}
                    >
                      {t('stock.adjustmentOut')}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.quantity')}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('quantityMode', 'count')
                      setDraft({ ...form.getValues(), quantityMode: 'count' })
                    }}
                    className={`${chipClassName(quantityMode === 'count')} active:scale-[0.98]`}
                  >
                    {t('stock.count')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('quantityMode', 'weight')
                      setDraft({ ...form.getValues(), quantityMode: 'weight' })
                    }}
                    className={`${chipClassName(quantityMode === 'weight')} active:scale-[0.98]`}
                  >
                    {t('stock.weight')}
                  </button>
                </div>
              </div>

              {quantityMode === 'count' ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.count')}</span>
                  <input type="number" min="0" {...form.register('count', { onChange: syncDraft })} className={fieldClassName} placeholder={t('stock.countPlaceholder')} />
                </label>
              ) : (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.weight')}</span>
                  <input type="number" min="0" step="0.1" {...form.register('weightKg', { onChange: syncDraft })} className={fieldClassName} placeholder={t('stock.weightPlaceholder')} />
                </label>
              )}

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-3 text-sm text-[var(--color-text-muted)]">
                <p>{t('stock.fishType')}: {selectedPondCycle?.fishType ?? '-'}</p>
                {quantityMode === 'count' && estimatedValues.estWeightKg !== null ? (
                  <p className="mt-1">{t('stock.estWeight')}: {formatNumber(Number(estimatedValues.estWeightKg.toFixed(1)))} kg</p>
                ) : null}
                {quantityMode === 'weight' && estimatedValues.estCount !== null ? (
                  <p className="mt-1">{t('stock.estCount')}: {formatNumber(estimatedValues.estCount)} {t('common.fish')}</p>
                ) : null}
                <p className="mt-1">{estimatedValues.helper}</p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.noteOptional')}</span>
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
                  onClick={() => setShowForm(false)}
                  className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-surface-muted)] active:scale-95"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!selectedPondCycle || (selectedUiType === 'transfer' && (!targetCycle || selectedPondId === targetPondId))}
                  className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
