import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import {
  closeCycle,
  archivePond,
  createPond,
  deleteDailyLog as deleteDailyLogMutation,
  deleteStockMovement as deleteStockMovementMutation,
  startCycle,
  transferCycle,
  updatePond,
  updateDailyLog,
  useFormOptionsQuery,
  usePondDetailQuery,
  usePondsListQuery,
} from '../../lib/api'
import { formatDate, formatDateTime, formatNumber, formatWeight, formatWeightPerFish } from '../../lib/format'
import { translate, useAppLanguage } from '../../lib/i18n'
import { isSupabaseConfigured } from '../../lib/supabase'
import { getCycleMovementTotals, getLatestSampleWeight } from '../../lib/stock'
import { useAppData } from '../app/app-data-context'
import { useAuth } from '../auth/auth-context'
import { useToast } from '../feedback/toast-provider'
import { openQuickAction } from '../layout/quick-action-modals'
import { EmptyState, StatusPill, Table } from '../shared/components'
import { DangerConfirmModal } from '../shared/danger-confirm-modal'

type PondTab = 'logs' | 'stock' | 'history'
type CycleDialog = 'start' | 'close' | 'transfer' | null

type AddPondDraft = {
  name: string
  type: string
  capacity: string
  status: 'active' | 'inactive'
  description: string
}

type LogEditDraft = {
  date: string
  feedG: string
  event: string
  action: string
  description: string
  sampleWeightG: string
  sampleCount: string
}

type HarvestWeightPoint = {
  date: string
  sample_weight_g?: number | null
}

const actionButtonClassName =
  'inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 text-[13px] font-semibold text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-95'

const primaryButtonClassName =
  'inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-95'

const fieldClassName =
  'w-full min-w-0 max-w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-base text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] md:text-sm'

const tabClassName = (active: boolean) =>
  `-mb-px border border-b-0 px-4 py-2.5 font-medium transition-all duration-150 ${
    active
      ? 'rounded-t-[var(--radius-control)] border-[var(--color-border)] bg-white text-[var(--color-primary-strong)]'
      : 'border-transparent bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
  }`

const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? '-' : `${value.toFixed(value < 10 ? 1 : 0)}%`

const getPondSortRank = (pond: { status: string; current_cycle?: unknown | null }) => {
  if (pond.current_cycle) return 0
  if (pond.status === 'active') return 1
  return 2
}

const movementTypeLabel = (type: string, t: (key: Parameters<typeof translate>[1]) => string) => {
  switch (type) {
    case 'stock_in':
      return t('stock.typeIn')
    case 'sold':
      return t('stock.typeSold')
    case 'died':
      return t('stock.typeDied')
    case 'transfer_in':
    case 'transfer_out':
      return t('stock.typeTransfer')
    case 'adjustment_in':
    case 'adjustment_out':
    case 'personal_use':
      return t('stock.typeAdjustment')
    default:
      return type
  }
}

const getCycleAgeDays = (dateStart: string) =>
  Math.max(0, Math.ceil((Date.now() - new Date(dateStart).getTime()) / 86_400_000))

const getToday = () => new Date().toISOString().slice(0, 10)

const getDateMs = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

const getGrowthRateGPerDay = (logs: HarvestWeightPoint[]) => {
  const points = logs
    .filter((log) => typeof log.sample_weight_g === 'number')
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))

  if (points.length < 2) return null

  const first = points[0]
  const last = points[points.length - 1]
  const firstMs = getDateMs(first.date)
  const lastMs = getDateMs(last.date)

  if (firstMs === null || lastMs === null || lastMs < firstMs) return null

  const daySpan = Math.max(1, Math.round((lastMs - firstMs) / 86_400_000))
  const delta = (last.sample_weight_g ?? 0) - (first.sample_weight_g ?? 0)

  return delta > 0 ? delta / daySpan : null
}

const LoadingPanel = () => (
  <div className="flex min-h-[260px] items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
  </div>
)

const SelectorItem = ({
  active,
  name,
  fishType,
  hasCycle,
  emptyLabel,
  onSelect,
}: {
  active: boolean
  name: string
  fishType?: string | null
  hasCycle: boolean
  emptyLabel: string
  onSelect: () => void
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full rounded-[var(--radius-control)] border border-[var(--color-border)] border-l-4 bg-white px-3 py-2 text-left transition-all duration-150 active:scale-[0.99] ${
      hasCycle ? 'border-l-[var(--color-primary)]' : 'border-l-[var(--color-border-strong)]'
    } ${active ? 'ring-1 ring-[var(--color-primary)]' : 'hover:bg-[var(--color-surface-muted)]'}`}
  >
    <p className="truncate text-sm font-semibold text-[var(--color-text)]">{name}</p>
    <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{fishType ?? emptyLabel}</p>
  </button>
)

const MetricBox = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-3">
    <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
    <p className="mt-1 text-base font-semibold text-[var(--color-text)]">{value}</p>
  </div>
)

const TabEmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-6 text-center">
    <p className="font-medium text-[var(--color-text)]">{title}</p>
    <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
  </div>
)

export const PondsPage = () => {
  const appData = useAppData()
  const auth = useAuth()
  const { showToast } = useToast()
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const isOwner = auth.profile?.role === 'owner'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedPondId, setSelectedPondId] = useState(searchParams.get('pond') ?? '')
  const [activeTab, setActiveTab] = useState<PondTab>('logs')
  const [showSelectorSheet, setShowSelectorSheet] = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [selectorQuery, setSelectorQuery] = useState('')
  const [cycleDialog, setCycleDialog] = useState<CycleDialog>(null)
  const [showAddPondDialog, setShowAddPondDialog] = useState(false)
  const [showEditPondDialog, setShowEditPondDialog] = useState(false)
  const [showArchivePondConfirm, setShowArchivePondConfirm] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [logEditId, setLogEditId] = useState<string | null>(null)
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null)
  const [deleteMovementId, setDeleteMovementId] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [addPondDraft, setAddPondDraft] = useState<AddPondDraft>({
    name: '',
    type: '',
    capacity: '',
    status: 'inactive',
    description: '',
  })
  const [editPondDraft, setEditPondDraft] = useState<AddPondDraft>({
    name: '',
    type: '',
    capacity: '',
    status: 'inactive',
    description: '',
  })
  const [addPondError, setAddPondError] = useState<string | null>(null)
  const [startDraft, setStartDraft] = useState({
    dateStart: getToday(),
    fishTypeId: '',
    initialStock: '',
    avgSeedWeightG: '',
    targetWeightG: '',
    capitalRp: '',
    description: '',
  })
  const [closeDraft, setCloseDraft] = useState({ dateEnd: getToday(), reason: '' })
  const [transferDraft, setTransferDraft] = useState({ date: getToday(), toUnitId: '', reason: '' })
  const [logDraft, setLogDraft] = useState<LogEditDraft>({
    date: getToday(),
    feedG: '',
    event: '',
    action: '',
    description: '',
    sampleWeightG: '',
    sampleCount: '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const pondsListQuery = usePondsListQuery({ include_inactive: true })
  const formOptionsQuery = useFormOptionsQuery()
  const apiPonds = pondsListQuery.data?.ponds ?? null
  const localPonds = appData.snapshot.ponds.map((pond) => {
    const cycle = appData.getCurrentCycleForPond(pond.id)
    return {
      pond_id: pond.id,
      pond_name: pond.name,
      pond_type: pond.type,
      capacity_fish: pond.capacity,
      status: pond.isActive ? ('active' as const) : ('inactive' as const),
      description: pond.description,
      current_cycle: cycle
        ? {
            cycle_id: cycle.id,
            cycle_name: cycle.name,
            fish_species: cycle.fishType,
            date_start: cycle.dateStart,
            days_since_stocking: getCycleAgeDays(cycle.dateStart),
          }
        : null,
    }
  })
  const ponds = useMemo(
    () =>
      (apiPonds ?? localPonds)
        .slice()
        .sort((left, right) => getPondSortRank(left) - getPondSortRank(right) || left.pond_name.localeCompare(right.pond_name)),
    [apiPonds, localPonds],
  )

  useEffect(() => {
    const pondFromQuery = searchParams.get('pond')
    if (pondFromQuery && pondFromQuery !== selectedPondId) {
      setSelectedPondId(pondFromQuery)
    }

    if (selectedPondId && ponds.length > 0 && !ponds.some((pond) => pond.pond_id === selectedPondId)) {
      setSelectedPondId(ponds[0].pond_id)
    }

    if (!pondFromQuery && !selectedPondId && ponds[0]) {
      setSelectedPondId(ponds[0].pond_id)
    }

    if (searchParams.get('quick') === 'log') {
      setActiveTab('logs')
      const next = new URLSearchParams(searchParams)
      next.delete('quick')
      setSearchParams(next, { replace: true })
    }
  }, [ponds, searchParams, selectedPondId, setSearchParams])

  const selectedPond = ponds.find((pond) => pond.pond_id === selectedPondId) ?? ponds[0]
  const detailQuery = usePondDetailQuery({
    pond_id: selectedPond?.pond_id ?? '',
    logs_limit: 30,
    stock_limit: 30,
  })
  const apiDetail = detailQuery.data
  const usingApiDetail = Boolean(apiDetail)
  const isDetailLoading = Boolean(selectedPond?.pond_id) && (detailQuery.isLoading || detailQuery.isFetching)

  const selectPond = (pondId: string) => {
    setSelectedPondId(pondId)
    setShowSelectorSheet(false)
    setSelectorQuery('')
    const next = new URLSearchParams(searchParams)
    next.set('pond', pondId)
    setSearchParams(next, { replace: true })
  }

  const summary = useMemo(() => {
    if (pondsListQuery.data?.summary) {
      return {
        total: pondsListQuery.data.summary.total_ponds,
        running: pondsListQuery.data.summary.active_ponds,
        empty: pondsListQuery.data.summary.empty_ponds,
      }
    }

    const total = ponds.length
    const running = ponds.filter((pond) => pond.current_cycle).length
    return { total, running, empty: total - running }
  }, [ponds, pondsListQuery.data?.summary])

  const localSelectedPond = appData.snapshot.ponds.find((pond) => pond.id === selectedPond?.pond_id)
  const localCurrentCycle = localSelectedPond ? appData.getCurrentCycleForPond(localSelectedPond.id) : undefined
  const localLogs = localSelectedPond
    ? appData.snapshot.dailyLogs
        .filter((log) => log.unitId === localSelectedPond.id && (!localCurrentCycle || log.cycleId === localCurrentCycle.id))
        .sort((left, right) => right.date.localeCompare(left.date))
    : []
  const localMovements = localSelectedPond
    ? appData.snapshot.stockMovements
        .filter((movement) => movement.unitId === localSelectedPond.id && (!localCurrentCycle || movement.cycleId === localCurrentCycle.id))
        .sort((left, right) => right.date.localeCompare(left.date))
    : []
  const localCycles = localSelectedPond
    ? appData.snapshot.cycles
        .filter((cycle) => cycle.unitId === localSelectedPond.id)
        .sort((left, right) => right.dateStart.localeCompare(left.dateStart))
    : []

  const currentCycle = apiDetail?.current_cycle
  const hasCurrentCycle = usingApiDetail ? Boolean(currentCycle) : Boolean(localCurrentCycle)
  const pondName = apiDetail?.pond.pond_name ?? selectedPond?.pond_name ?? localSelectedPond?.name ?? ''
  const fishSpecies = currentCycle?.fish_species ?? localCurrentCycle?.fishType ?? null
  const cycleName = currentCycle?.cycle_name ?? localCurrentCycle?.name ?? null
  const cycleAgeDays = currentCycle?.days_since_stocking ?? (localCurrentCycle ? getCycleAgeDays(localCurrentCycle.dateStart) : null)
  const dateStart = currentCycle?.date_start ?? localCurrentCycle?.dateStart ?? null
  const liveFish = currentCycle?.live_fish_count ?? (localCurrentCycle ? Math.max(getCycleMovementTotals(localCurrentCycle.id, appData.snapshot.stockMovements).alive, 0) : 0)
  const avgWeight = currentCycle?.avg_weight_g ?? (localCurrentCycle ? getLatestSampleWeight(localCurrentCycle.id, appData.snapshot.dailyLogs) : null)
  const survival = currentCycle?.survival_rate_pct ?? (localCurrentCycle && localCurrentCycle.initialStock > 0 ? (liveFish / localCurrentCycle.initialStock) * 100 : null)
  const targetWeight = currentCycle?.target_weight_g ?? localCurrentCycle?.targetWeightG ?? null
  const lastLogLabel = currentCycle?.last_log?.relative_label ?? (localLogs[0] ? formatDateTime(localLogs[0].date) : '-')
  const pondDescription = apiDetail?.pond.description ?? localSelectedPond?.description ?? ''

  const logs = !hasCurrentCycle
    ? []
    : apiDetail
      ? apiDetail.daily_logs.map((log) => ({ ...log, can_update: isOwner || log.can_update, can_delete: isOwner || log.can_delete }))
      : localLogs.map((log) => ({
        log_id: log.id,
        date: log.date,
        logged_at: null,
        feed_g: log.feedG,
        sample_weight_g: log.sampleWeightG,
        sample_count: log.sampleCount,
        event: log.event,
        action: log.action,
        description: log.description,
        can_update: isOwner,
        can_delete: isOwner,
      }))

  const movements = !hasCurrentCycle
    ? []
    : apiDetail
      ? apiDetail.stock_movements.map((movement) => ({
        ...movement,
        movement_label: movementTypeLabel(movement.movement_type, t),
        can_delete: isOwner || movement.can_delete,
      }))
      : localMovements.map((movement) => ({
        movement_id: movement.id,
        date: movement.date,
        movement_type: movement.movementType,
        movement_label: movementTypeLabel(movement.movementType, t),
        count: movement.count,
        weight_kg: movement.weightKg,
        description: movement.description,
        created_at: movement.createdAt,
        can_delete: isOwner,
      }))

  const cycleHistory = apiDetail
    ? apiDetail.cycle_history
    : localCycles.map((cycle) => ({
        cycle_id: cycle.id,
        cycle_name: cycle.name,
        fish_species: cycle.fishType,
        date_start: cycle.dateStart,
        date_end: cycle.dateEnd,
        initial_stock_count: cycle.initialStock,
        status: cycle.dateEnd ? ('closed' as const) : ('running' as const),
      }))

  const recentWeightLogs = logs
    .filter((log) => log.sample_weight_g !== null && log.sample_weight_g !== undefined)
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-7)
  const growthDelta =
    recentWeightLogs.length >= 2
      ? (recentWeightLogs[recentWeightLogs.length - 1].sample_weight_g ?? 0) - (recentWeightLogs[0].sample_weight_g ?? 0)
      : null
  const backendHarvestDays =
    typeof currentCycle?.harvest_prediction?.days_left === 'number' ? currentCycle.harvest_prediction.days_left : null
  const recentGrowthRateGPerDay = getGrowthRateGPerDay(recentWeightLogs)
  const projectedHarvestDays =
    avgWeight !== null &&
    avgWeight !== undefined &&
    targetWeight !== null &&
    targetWeight !== undefined &&
    targetWeight > avgWeight &&
    recentGrowthRateGPerDay !== null
      ? Math.ceil((targetWeight - avgWeight) / recentGrowthRateGPerDay)
      : null
  const harvestLabel = (() => {
    if (targetWeight === null || targetWeight === undefined || targetWeight <= 0) return t('pond.harvestNeedTarget')
    if (avgWeight === null || avgWeight === undefined || avgWeight <= 0) return t('pond.harvestNeedAvg')
    if (avgWeight >= targetWeight) return t('pond.harvestReady')
    if (backendHarvestDays !== null && backendHarvestDays > 0) return t('pond.harvestDaysLeft').replace('{days}', String(backendHarvestDays))
    if (projectedHarvestDays !== null) return t('pond.harvestDaysLeft').replace('{days}', String(projectedHarvestDays))
    return t('pond.harvestNeedGrowth')
  })()
  const harvestHelper = projectedHarvestDays !== null ? t('pond.harvestBasis') : null

  const selectorItems = ponds.filter((pond) => pond.pond_name.toLowerCase().includes(selectorQuery.toLowerCase()))
  const currentCycleId = currentCycle?.cycle_id ?? localCurrentCycle?.id ?? null
  const fishTypeOptions = formOptionsQuery.data?.fish_types ?? []
  const transferTargetOptions = ponds
    .filter((pond) => pond.pond_id !== selectedPond?.pond_id && !pond.current_cycle)
    .map((pond) => ({ pond_id: pond.pond_id, pond_name: pond.pond_name }))
  const selectedLog = logEditId ? logs.find((log) => log.log_id === logEditId) : undefined
  const deleteLog = deleteLogId ? logs.find((log) => log.log_id === deleteLogId) : undefined
  const deleteMovement = deleteMovementId ? movements.find((movement) => movement.movement_id === deleteMovementId) : undefined
  const canCreatePond = isOwner
  const pondSummary = t('pond.summary')
    .replace('{total}', String(summary.total))
    .replace('{running}', String(summary.running))
    .replace('{empty}', String(summary.empty))

  useEffect(() => {
    if (!startDraft.fishTypeId && fishTypeOptions[0]) {
      setStartDraft((draft) => ({ ...draft, fishTypeId: fishTypeOptions[0].fish_type_id }))
    }
  }, [fishTypeOptions, startDraft.fishTypeId])

  useEffect(() => {
    if (!transferDraft.toUnitId && transferTargetOptions[0]) {
      setTransferDraft((draft) => ({ ...draft, toUnitId: transferTargetOptions[0].pond_id }))
    }
  }, [transferDraft.toUnitId, transferTargetOptions])

  const refreshPondQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['read-api', 'dashboard-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'ponds-list'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'pond-detail'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'stock-movements'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'form-options'] }),
    ])
  }

  const openAddPond = () => {
    setAddPondError(null)
    setAddPondDraft({
      name: '',
      type: '',
      capacity: '',
      status: 'inactive',
      description: '',
    })
    setShowAddPondDialog(true)
  }

  const submitAddPond = async () => {
    const name = addPondDraft.name.trim()
    const capacity = addPondDraft.capacity.trim() ? Number(addPondDraft.capacity) : null

    if (!name) {
      setAddPondError(t('pond.nameRequired'))
      showToast(t('common.validationFailed'), 'error', t('pond.nameRequired'))
      return
    }

    if (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) {
      setAddPondError(t('pond.capacityPositive'))
      showToast(t('common.validationFailed'), 'error', t('pond.capacityPositive'))
      return
    }

    setIsMutating(true)
    setAddPondError(null)
    try {
      const result = await createPond({
        name,
        type: addPondDraft.type.trim() || null,
        capacity,
        isActive: addPondDraft.status === 'active',
        description: addPondDraft.description.trim() || null,
      })
      await refreshPondQueries()
      const pondId = result.item?.pond_id
      if (pondId) {
        setSelectedPondId(pondId)
        const next = new URLSearchParams(searchParams)
        next.set('pond', pondId)
        setSearchParams(next, { replace: true })
      }
      setShowAddPondDialog(false)
      showToast(t('pond.added'), 'success', t('pond.addedDesc'))
    } catch {
      showToast(t('pond.couldNotAdd'), 'error', t('pond.ownerOnlyAdd'))
    } finally {
      setIsMutating(false)
    }
  }

  const openEditPond = () => {
    if (!selectedPond) return
    setAddPondError(null)
    setEditPondDraft({
      name: apiDetail?.pond.pond_name ?? selectedPond.pond_name,
      type: apiDetail?.pond.pond_type ?? selectedPond.pond_type ?? '',
      capacity:
        apiDetail?.pond.capacity_fish !== null && apiDetail?.pond.capacity_fish !== undefined
          ? String(apiDetail.pond.capacity_fish)
          : selectedPond.capacity_fish !== null && selectedPond.capacity_fish !== undefined
            ? String(selectedPond.capacity_fish)
            : '',
      status: (apiDetail?.pond.status ?? selectedPond.status) === 'active' ? 'active' : 'inactive',
      description: apiDetail?.pond.description ?? selectedPond.description ?? '',
    })
    setShowEditPondDialog(true)
  }

  const submitEditPond = async () => {
    if (!selectedPond?.pond_id) return
    const name = editPondDraft.name.trim()
    const capacity = editPondDraft.capacity.trim() ? Number(editPondDraft.capacity) : null

    if (!name) {
      setAddPondError(t('pond.nameRequired'))
      showToast(t('common.validationFailed'), 'error', t('pond.nameRequired'))
      return
    }

    if (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) {
      setAddPondError(t('pond.capacityPositive'))
      showToast(t('common.validationFailed'), 'error', t('pond.capacityPositive'))
      return
    }

    setIsMutating(true)
    setAddPondError(null)
    try {
      await updatePond(selectedPond.pond_id, {
        name,
        type: editPondDraft.type.trim() || null,
        capacity,
        isActive: editPondDraft.status === 'active',
        description: editPondDraft.description.trim() || null,
      })
      await refreshPondQueries()
      setShowEditPondDialog(false)
      showToast(t('pond.updated'), 'success', t('pond.updatedDesc'))
    } catch {
      showToast(t('pond.couldNotAdd'), 'error', t('pond.ownerOnlyAdd'))
    } finally {
      setIsMutating(false)
    }
  }

  const confirmArchivePond = async () => {
    if (!selectedPond?.pond_id) return
    setIsMutating(true)
    try {
      await archivePond(selectedPond.pond_id)
      await refreshPondQueries()
      setShowArchivePondConfirm(false)
      showToast(t('pond.archived'), 'success', t('pond.archivedDesc'))
    } catch {
      showToast(t('pond.archive'), 'error', hasCurrentCycle ? t('pond.archiveBlocked') : t('pond.checkAccessConnection'))
    } finally {
      setIsMutating(false)
    }
  }

  const openLogEdit = (logId: string) => {
    const log = logs.find((item) => item.log_id === logId)
    if (!log) return
    setLogEditId(log.log_id)
    setLogDraft({
      date: log.date,
      feedG: String(log.feed_g ?? ''),
      event: log.event ?? '',
      action: log.action ?? '',
      description: log.description ?? '',
      sampleWeightG: log.sample_weight_g === null || log.sample_weight_g === undefined ? '' : String(log.sample_weight_g),
      sampleCount: log.sample_count === null || log.sample_count === undefined ? '' : String(log.sample_count),
    })
  }

  const saveLogEdit = async () => {
    if (!selectedLog) return
    if (!logDraft.date || Number(logDraft.feedG) < 0 || (logDraft.sampleWeightG && Number(logDraft.sampleWeightG) < 0) || (logDraft.sampleCount && Number(logDraft.sampleCount) < 0)) {
      setFormError(t('pond.checkDateAndNumbers'))
      showToast(t('common.validationFailed'), 'error', t('pond.checkDailyLogForm'))
      return
    }
    setIsMutating(true)
    setFormError(null)
    try {
      await updateDailyLog(selectedLog.log_id, {
        date: logDraft.date,
        feedG: Number(logDraft.feedG || 0),
        event: logDraft.event,
        action: logDraft.action,
        description: logDraft.description,
        sampleWeightG: logDraft.sampleWeightG ? Number(logDraft.sampleWeightG) : null,
        sampleCount: logDraft.sampleCount ? Number(logDraft.sampleCount) : null,
      })
      await refreshPondQueries()
      setLogEditId(null)
      showToast(t('pond.logUpdated'), 'success', t('pond.logUpdatedDesc'))
    } catch {
      showToast(t('pond.couldNotSaveLog'), 'error', t('pond.checkAccessConnection'))
    } finally {
      setIsMutating(false)
    }
  }

  const confirmDeleteLog = async () => {
    if (!deleteLogId) return
    setIsMutating(true)
    try {
      await deleteDailyLogMutation(deleteLogId)
      await refreshPondQueries()
      setDeleteLogId(null)
      showToast(t('pond.logDeleted'), 'success', t('pond.logDeletedDesc'))
    } catch {
      showToast(t('pond.deleteDailyLog'), 'error', t('pond.checkAccessConnection'))
    } finally {
      setIsMutating(false)
    }
  }

  const confirmDeleteMovement = async () => {
    if (!deleteMovementId) return
    setIsMutating(true)
    try {
      await deleteStockMovementMutation(deleteMovementId)
      await refreshPondQueries()
      setDeleteMovementId(null)
      showToast(t('pond.stockDeleted'), 'success', t('pond.stockDeletedDesc'))
    } catch {
      showToast(t('pond.couldNotDeleteStock'), 'error', t('pond.generatedProtected'))
    } finally {
      setIsMutating(false)
    }
  }

  const submitStartCycle = async () => {
    if (!selectedPond?.pond_id || !startDraft.fishTypeId) return
    if (!startDraft.dateStart || Number(startDraft.initialStock) <= 0) {
      setFormError(`${t('pond.initialStock')} > 0.`)
      showToast(t('common.validationFailed'), 'error', `${t('pond.initialStock')} > 0.`)
      return
    }
    if (Number(startDraft.avgSeedWeightG || 0) < 0 || Number(startDraft.targetWeightG || 0) < 0 || Number(startDraft.capitalRp || 0) < 0) {
      setFormError(t('pond.nonNegativeNumbers'))
      showToast(t('common.validationFailed'), 'error', t('pond.nonNegativeNumbers'))
      return
    }
    setIsMutating(true)
    setFormError(null)
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
      await startCycle({
        unitId: selectedPond.pond_id,
        fishTypeId: startDraft.fishTypeId,
        dateStart: startDraft.dateStart,
        initialStock: Number(startDraft.initialStock || 0),
        avgSeedWeightG: startDraft.avgSeedWeightG ? Number(startDraft.avgSeedWeightG) : null,
        targetWeightG: startDraft.targetWeightG ? Number(startDraft.targetWeightG) : null,
        capitalRp: Number(startDraft.capitalRp || 0),
        description: startDraft.description,
      })
      await refreshPondQueries()
      setCycleDialog(null)
      setActiveTab('logs')
      showToast(t('pond.cycleStarted'), 'success', t('pond.nowRunning').replace('{pond}', pondName))
    } catch {
      showToast(t('pond.couldNotStartCycle'), 'error', t('pond.checkDailyLogForm'))
    } finally {
      setIsMutating(false)
    }
  }

  const submitCloseCycle = async () => {
    if (!currentCycleId) return
    if (!closeDraft.dateEnd || !closeDraft.reason.trim()) {
      setFormError(t('pond.closeRequired'))
      showToast(t('common.validationFailed'), 'error', t('pond.closeRequired'))
      return
    }
    setIsMutating(true)
    setFormError(null)
    try {
      if (isSupabaseConfigured) {
        await closeCycle({ cycleId: currentCycleId, dateEnd: closeDraft.dateEnd, reason: closeDraft.reason })
        await refreshPondQueries()
      } else {
        appData.closeCycle({ cycleId: currentCycleId, dateEnd: closeDraft.dateEnd, reason: closeDraft.reason })
      }
      setCycleDialog(null)
      setShowCloseConfirm(false)
      showToast(t('pond.cycleClosed'), 'success', t('pond.noLongerRunning').replace('{pond}', pondName))
    } catch {
      showToast(t('pond.couldNotCloseCycle'), 'error', t('pond.checkAccessConnection'))
    } finally {
      setIsMutating(false)
    }
  }

  const submitTransferCycle = async () => {
    if (!currentCycleId || !transferDraft.toUnitId) return
    if (!transferDraft.date || !transferDraft.reason.trim()) {
      setFormError(`${t('pond.transferDate')} ${t('pond.reason')}`)
      showToast(t('common.validationFailed'), 'error', `${t('pond.transferDate')} ${t('pond.reason')}`)
      return
    }
    setIsMutating(true)
    setFormError(null)
    try {
      if (isSupabaseConfigured) {
        await transferCycle({
          cycleId: currentCycleId,
          toUnitId: transferDraft.toUnitId,
          date: transferDraft.date,
          reason: transferDraft.reason,
        })
        await refreshPondQueries()
      } else {
        appData.transferCycle({
          cycleId: currentCycleId,
          toUnitId: transferDraft.toUnitId,
          dateEnd: transferDraft.date,
          reason: transferDraft.reason,
        })
      }
      setCycleDialog(null)
      showToast(t('pond.cycleTransferred'), 'success', t('pond.transferSuccessDesc'))
    } catch {
      showToast(t('pond.couldNotTransferCycle'), 'error', t('pond.transferTargetHint'))
    } finally {
      setIsMutating(false)
    }
  }

  const selectMoreAction = (action: 'stock' | 'transfer' | 'close') => {
    setShowMoreActions(false)
    if (action === 'stock') {
      openQuickAction({ type: 'stock', pondId: selectedPond?.pond_id })
      return
    }
    setFormError(null)
    setCycleDialog(action)
  }

  const pageHeader = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t('pond.title')}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{pondSummary}</p>
      </div>
      {canCreatePond ? (
        <button type="button" onClick={openAddPond} className={`${primaryButtonClassName} w-full md:w-auto`}>
          {t('pond.add')}
        </button>
      ) : null}
    </div>
  )

  const addPondModal = showAddPondDialog ? (
    <div className="overlay-fade fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 md:items-center md:p-4">
      <div className="sheet-up max-h-[88vh] w-full overflow-y-auto rounded-t-[16px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-strong)] md:modal-pop md:max-w-md md:rounded-[var(--radius-shell)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">{t('pond.add')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('pond.addSubtitle')}</p>
          </div>
          <button type="button" onClick={() => setShowAddPondDialog(false)} className={actionButtonClassName}>
            x
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {addPondError ? <p className="rounded-[var(--radius-control)] bg-rose-50 px-3 py-2 text-sm text-rose-700">{addPondError}</p> : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.name')}</span>
            <input
              value={addPondDraft.name}
              onChange={(event) => setAddPondDraft((draft) => ({ ...draft, name: event.target.value }))}
              className={fieldClassName}
              placeholder={t('pond.namePlaceholder')}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.type')}</span>
              <input
                value={addPondDraft.type}
                onChange={(event) => setAddPondDraft((draft) => ({ ...draft, type: event.target.value }))}
                className={fieldClassName}
                placeholder={t('pond.typePlaceholder')}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.capacity')}</span>
              <input
                type="number"
                min="0"
                value={addPondDraft.capacity}
                onChange={(event) => setAddPondDraft((draft) => ({ ...draft, capacity: event.target.value }))}
                className={fieldClassName}
                placeholder="0"
              />
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.status')}</span>
            <select
              value={addPondDraft.status}
              onChange={(event) => setAddPondDraft((draft) => ({ ...draft, status: event.target.value as AddPondDraft['status'] }))}
              className={fieldClassName}
            >
              <option value="inactive">{t('common.status.inactive')} / {t('common.empty')}</option>
              <option value="active">{t('common.status.active')}</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.description')}</span>
            <textarea
              rows={3}
              value={addPondDraft.description}
              onChange={(event) => setAddPondDraft((draft) => ({ ...draft, description: event.target.value }))}
              className={`${fieldClassName} min-h-[88px]`}
              placeholder={t('pond.notes')}
            />
          </label>
          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <button type="button" onClick={() => setShowAddPondDialog(false)} className={actionButtonClassName}>
              {t('common.cancel')}
            </button>
            <button type="button" disabled={isMutating} onClick={() => void submitAddPond()} className={`${primaryButtonClassName} disabled:cursor-not-allowed disabled:opacity-60`}>
              {isMutating ? t('settings.saving') : t('pond.savePond')}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  const editPondModal = showEditPondDialog ? (
    <div className="overlay-fade fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 md:items-center md:p-4">
      <div className="sheet-up max-h-[88vh] w-full overflow-y-auto rounded-t-[16px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-strong)] md:modal-pop md:max-w-md md:rounded-[var(--radius-shell)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">{t('pond.edit')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{pondName}</p>
          </div>
          <button type="button" onClick={() => setShowEditPondDialog(false)} className={actionButtonClassName}>
            x
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {addPondError ? <p className="rounded-[var(--radius-control)] bg-rose-50 px-3 py-2 text-sm text-rose-700">{addPondError}</p> : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.name')}</span>
            <input value={editPondDraft.name} onChange={(event) => setEditPondDraft((draft) => ({ ...draft, name: event.target.value }))} className={fieldClassName} />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.type')}</span>
              <input value={editPondDraft.type} onChange={(event) => setEditPondDraft((draft) => ({ ...draft, type: event.target.value }))} className={fieldClassName} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.capacity')}</span>
              <input type="number" min="0" value={editPondDraft.capacity} onChange={(event) => setEditPondDraft((draft) => ({ ...draft, capacity: event.target.value }))} className={fieldClassName} />
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.status')}</span>
            <select value={editPondDraft.status} onChange={(event) => setEditPondDraft((draft) => ({ ...draft, status: event.target.value as AddPondDraft['status'] }))} className={fieldClassName}>
              <option value="inactive">{t('common.status.inactive')} / {t('common.empty')}</option>
              <option value="active">{t('common.status.active')}</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.description')}</span>
            <textarea rows={3} value={editPondDraft.description} onChange={(event) => setEditPondDraft((draft) => ({ ...draft, description: event.target.value }))} className={`${fieldClassName} min-h-[88px]`} />
          </label>
          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <button type="button" onClick={() => setShowEditPondDialog(false)} className={actionButtonClassName}>
              {t('common.cancel')}
            </button>
            <button type="button" disabled={isMutating} onClick={() => void submitEditPond()} className={`${primaryButtonClassName} disabled:cursor-not-allowed disabled:opacity-60`}>
              {isMutating ? t('settings.saving') : t('common.update')}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  if (!selectedPond && !pondsListQuery.isLoading) {
    return (
      <div className="space-y-5">
        {pageHeader}
        <EmptyState title={t('pond.noData')} description={canCreatePond ? t('pond.noDataOwner') : t('pond.noDataMember')} />
        {addPondModal}
        {editPondModal}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {pageHeader}

      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="min-w-0 space-y-5">
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-3 md:hidden">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-text)]">{pondName || t('pond.choose')}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{fishSpecies ?? t('pond.noRunningCycle')}</p>
            </div>
            <button type="button" onClick={() => setShowSelectorSheet(true)} className={actionButtonClassName}>
              {t('pond.change')}
            </button>
          </div>

          {isDetailLoading ? (
            <LoadingPanel />
          ) : (
            <>
              <section className="border-t border-[var(--color-border)] pt-5">
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold text-[var(--color-text)]">
                        {pondName}
                        {fishSpecies ? ` - ${fishSpecies}` : ''}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {t('pond.status')}: {hasCurrentCycle ? t('pond.running') : t('pond.notActive')}
                      </p>
                      {hasCurrentCycle ? (
                        <>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            {cycleName && cycleAgeDays !== null ? `${cycleName} - ${cycleAgeDays} ${t('pond.daysSinceStocking')}` : cycleName}
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            {t('pond.lastLog')}: {lastLogLabel}
                          </p>
                        </>
                      ) : null}
                    </div>
                    <div className="grid w-full grid-cols-[1fr_auto] gap-2 md:flex md:w-auto md:flex-wrap">
                      {hasCurrentCycle ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openQuickAction({ type: 'log', pondId: selectedPond?.pond_id })}
                            className={`${primaryButtonClassName} w-full md:w-auto`}
                          >
                            {t('pond.addLog')}
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowMoreActions((value) => !value)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-95"
                              aria-label={t('common.actions')}
                              aria-expanded={showMoreActions}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                                <circle cx="12" cy="5" r="1.8" />
                                <circle cx="12" cy="12" r="1.8" />
                                <circle cx="12" cy="19" r="1.8" />
                              </svg>
                            </button>
                            {showMoreActions ? (
                              <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-1 shadow-[var(--shadow-strong)]">
                                <button type="button" onClick={() => selectMoreAction('stock')} className="w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]">
                                  {t('stock.updateStock')}
                                </button>
                                <button type="button" onClick={() => selectMoreAction('transfer')} className="w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]">
                                  {t('stock.typeTransfer')}
                                </button>
                                <button type="button" onClick={() => selectMoreAction('close')} className="w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-[var(--color-danger-soft)]">
                                  {t('pond.closeCycle')}
                                </button>
                                {isOwner ? (
                                  <>
                                    <button type="button" onClick={() => { setShowMoreActions(false); openEditPond() }} className="w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]">
                                      {t('pond.edit')}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => { setFormError(null); setCycleDialog('start') }} className={`${primaryButtonClassName} w-full md:w-auto`}>
                            {t('pond.startNewCycle')}
                          </button>
                          {isOwner ? (
                            <div className="grid grid-cols-2 gap-2 md:flex">
                              <button type="button" onClick={openEditPond} className={`${actionButtonClassName} w-full md:w-auto`}>
                                {t('pond.edit')}
                              </button>
                              <button type="button" onClick={() => setShowArchivePondConfirm(true)} className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-rose-200 bg-[var(--color-danger-soft)] px-3 text-[13px] font-semibold text-rose-700 transition-all duration-150 hover:bg-rose-100 active:scale-95">
                                {t('pond.archive')}
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {hasCurrentCycle ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <MetricBox label={t('pond.totalFish')} value={`${formatNumber(liveFish)} ${t('common.fish')}`} />
                      <MetricBox label={t('pond.survivalRate')} value={formatPercent(survival)} />
                      <MetricBox label={t('pond.avgWeight')} value={formatWeightPerFish(avgWeight, t('common.fish'))} />
                      <MetricBox label={t('pond.targetWeight')} value={formatWeightPerFish(targetWeight, t('common.fish'))} />
                    </div>
                  ) : (
                    <TabEmptyState title={t('pond.emptyTitle')} description={t('pond.emptyDesc')} />
                  )}

                  {hasCurrentCycle ? (
                    <>
                      <div className="space-y-2 text-sm text-[var(--color-text)]">
                        {dateStart ? <p>{t('pond.stocked')}: {formatDate(dateStart)}</p> : null}
                        <div>
                          <p>{t('pond.estimatedHarvest')}: {harvestLabel}</p>
                          {harvestHelper ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{harvestHelper}</p> : null}
                        </div>
                        <p className="leading-6 text-[var(--color-text-muted)]">{t('pond.notes')}: {pondDescription || '-'}</p>
                      </div>

                      <div className="border-t border-[var(--color-border)] pt-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-text)]">{t('pond.growth')}</p>
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                              {growthDelta !== null ? `${growthDelta >= 0 ? '+' : ''}${formatNumber(growthDelta)}g / ${t('pond.recentLogs')}` : t('pond.notEnoughGrowth')}
                            </p>
                          </div>
                          {recentWeightLogs.length >= 2 ? (
                            <div className="h-16 w-full max-w-[220px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={recentWeightLogs.map((log) => ({ date: log.date, weight: log.sample_weight_g }))}>
                                  <Line type="monotone" dataKey="weight" stroke="#3B82F6" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="border-t border-[var(--color-border)] pt-5">
                <div className="border-b border-[var(--color-border)]">
                  {[
                    { value: 'logs' as const, label: t('pond.dailyLogs') },
                    { value: 'stock' as const, label: t('pond.stockMovements') },
                    { value: 'history' as const, label: t('pond.cycleHistory') },
                  ].map((tab) => (
                    <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} className={tabClassName(activeTab === tab.value)}>
                      <span className="text-[13px]">{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-4">
                  {activeTab === 'logs' ? (
                    logs.length > 0 ? (
                      <div className="hidden md:block">
                        <Table
                          headers={logs.some((log) => log.can_update || log.can_delete) ? [t('common.date'), t('pond.feed'), t('pond.description'), t('pond.sampleWeight'), t('pond.event'), t('common.actions')] : [t('common.date'), t('pond.feed'), t('pond.description'), t('pond.sampleWeight'), t('pond.event')]}
                          rows={logs.slice(0, 10).map((log) => {
                            const base = [
                              formatDate(log.date),
                              formatWeight(log.feed_g),
                              log.description || '-',
                              formatWeightPerFish(log.sample_weight_g ?? null, t('common.fish')),
                              log.event || log.action || '-',
                            ]
                            if (!logs.some((item) => item.can_update || item.can_delete)) return base
                            return [
                              ...base,
                              log.can_update || log.can_delete ? (
                                <div key={`${log.log_id}-actions`} className="flex flex-wrap gap-2">
                                  {log.can_update ? (
                                    <button type="button" onClick={() => openLogEdit(log.log_id)} className="text-sm font-medium text-[var(--color-primary)]">
                                      {t('common.edit')}
                                    </button>
                                  ) : null}
                                  {log.can_delete ? (
                                    <button type="button" onClick={() => setDeleteLogId(log.log_id)} className="text-sm font-medium text-rose-600">
                                      {t('common.delete')}
                                    </button>
                                  ) : null}
                                </div>
                              ) : (
                                <span key={`${log.log_id}-no-action`} className="text-sm text-[var(--color-text-muted)]">-</span>
                              ),
                            ]
                          })}
                        />
                      </div>
                    ) : (
                      <TabEmptyState title={t('pond.noLogs')} description={t('pond.noLogsDesc')} />
                    )
                  ) : activeTab === 'stock' ? (
                    movements.length > 0 ? (
                      <div className="hidden md:block">
                        <Table
                          headers={movements.some((movement) => movement.can_delete) ? [t('common.date'), t('common.type'), t('stock.count'), t('stock.weight'), t('common.note'), t('common.actions')] : [t('common.date'), t('common.type'), t('stock.count'), t('stock.weight'), t('common.note')]}
                          rows={movements.slice(0, 10).map((movement) => {
                            const base = [
                              formatDate(movement.date),
                              movement.movement_label,
                              `${formatNumber(movement.count)} ${t('common.fish')}`,
                              movement.weight_kg ? `${formatNumber(movement.weight_kg)} kg` : '-',
                              movement.description || '-',
                            ]
                            if (!movements.some((item) => item.can_delete)) return base
                            return [
                              ...base,
                              movement.can_delete ? (
                                <button key={`${movement.movement_id}-actions`} type="button" onClick={() => setDeleteMovementId(movement.movement_id)} className="text-sm font-medium text-rose-600">
                                  {t('common.delete')}
                                </button>
                              ) : (
                                <span key={`${movement.movement_id}-no-action`} className="text-sm text-[var(--color-text-muted)]">-</span>
                              ),
                            ]
                          })}
                        />
                      </div>
                    ) : (
                      <TabEmptyState title={t('pond.noStock')} description={t('pond.noStockDesc')} />
                    )
                  ) : cycleHistory.length > 0 ? (
                    <div className="hidden md:block">
                      <Table
                        headers={[t('pond.cycle'), t('stock.fishType'), t('pond.startDate'), t('pond.end'), t('pond.initialStock')]}
                        rows={cycleHistory.map((cycle) => [
                          cycle.cycle_name,
                          cycle.fish_species,
                          formatDate(cycle.date_start),
                          cycle.date_end ? formatDate(cycle.date_end) : t('pond.running'),
                          `${formatNumber(cycle.initial_stock_count)} ${t('common.fish')}`,
                        ])}
                      />
                    </div>
                  ) : (
                    <TabEmptyState title={t('pond.noHistory')} description={t('pond.noHistoryDesc')} />
                  )}

                  <div className="space-y-3 md:hidden">
                    {activeTab === 'logs' && logs.length > 0
                      ? logs.slice(0, 10).map((log) => (
                          <div key={log.log_id} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[var(--color-text)]">{formatDate(log.date)}</p>
                                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{log.description || t('pond.noDescription')}</p>
                              </div>
                              <StatusPill>{formatWeight(log.feed_g)}</StatusPill>
                            </div>
                            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                              {t('common.sample')}: {formatWeightPerFish(log.sample_weight_g ?? null, t('common.fish'))} | {log.event || log.action || '-'}
                            </p>
                            {log.can_update || log.can_delete ? (
                              <div className="mt-4 flex justify-end gap-3">
                                {log.can_update ? (
                                  <button type="button" onClick={() => openLogEdit(log.log_id)} className="text-sm font-medium text-[var(--color-primary)]">
                                    {t('common.edit')}
                                  </button>
                                ) : null}
                                {log.can_delete ? (
                                  <button type="button" onClick={() => setDeleteLogId(log.log_id)} className="text-sm font-medium text-rose-600">
                                    {t('common.delete')}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))
                      : null}
                    {activeTab === 'stock' && movements.length > 0
                      ? movements.slice(0, 10).map((movement) => (
                          <div key={movement.movement_id} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[var(--color-text)]">{formatDate(movement.date)}</p>
                                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{movement.description || t('pond.stockMovement')}</p>
                              </div>
                              <StatusPill>{movement.movement_label}</StatusPill>
                            </div>
                            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                              {formatNumber(movement.count)} {t('common.fish')} | {movement.weight_kg ? `${formatNumber(movement.weight_kg)} kg` : '-'}
                            </p>
                            {movement.can_delete ? (
                              <div className="mt-4 flex justify-end">
                                <button type="button" onClick={() => setDeleteMovementId(movement.movement_id)} className="text-sm font-medium text-rose-600">
                                  {t('common.delete')}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))
                      : null}
                    {activeTab === 'history' && cycleHistory.length > 0
                      ? cycleHistory.map((cycle) => (
                          <div key={cycle.cycle_id} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4">
                            <p className="text-sm font-semibold text-[var(--color-text)]">{cycle.cycle_name}</p>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{cycle.fish_species}</p>
                            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                              {formatDate(cycle.date_start)} - {cycle.date_end ? formatDate(cycle.date_end) : t('pond.running')} | {formatNumber(cycle.initial_stock_count)} {t('common.fish')}
                            </p>
                          </div>
                        ))
                      : null}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <aside className="hidden md:block">
          <div className="sticky top-6 space-y-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[var(--color-text)]">{t('pond.choose')}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">{t('pond.chooseHint')}</p>
            </div>
            <input
              value={selectorQuery}
              onChange={(event) => setSelectorQuery(event.target.value)}
              className={fieldClassName}
              placeholder={t('pond.searchPlaceholder')}
            />
            <div className="space-y-1.5">
              {selectorItems.map((pond) => (
                <SelectorItem
                  key={pond.pond_id}
                  active={pond.pond_id === selectedPond?.pond_id}
                  name={pond.pond_name}
                  fishType={pond.current_cycle?.fish_species}
                  hasCycle={Boolean(pond.current_cycle)}
                  emptyLabel={t('pond.noRunningCycle')}
                  onSelect={() => selectPond(pond.pond_id)}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>

      {showSelectorSheet ? (
        <div className="overlay-fade fixed inset-0 z-40 flex items-end bg-slate-950/40 md:hidden">
          <div className="sheet-up w-full rounded-t-[16px] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-strong)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">{t('pond.choose')}</h2>
              <button type="button" onClick={() => setShowSelectorSheet(false)} className={actionButtonClassName}>
                x
              </button>
            </div>
            <input
              value={selectorQuery}
              onChange={(event) => setSelectorQuery(event.target.value)}
              className={`${fieldClassName} mt-4`}
              placeholder={t('pond.searchPlaceholder')}
            />
            <div className="mt-4 max-h-[60vh] space-y-1.5 overflow-y-auto pb-4">
              {selectorItems.map((pond) => (
                <SelectorItem
                  key={pond.pond_id}
                  active={pond.pond_id === selectedPond?.pond_id}
                  name={pond.pond_name}
                  fishType={pond.current_cycle?.fish_species}
                  hasCycle={Boolean(pond.current_cycle)}
                  emptyLabel={t('pond.noRunningCycle')}
                  onSelect={() => selectPond(pond.pond_id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {addPondModal}
      {editPondModal}

      <DangerConfirmModal
        open={showArchivePondConfirm}
        title={t('pond.archiveTitle')}
        message={t('pond.archiveMessage')}
        detail={pondName ? `${pondName}. ${t('common.cannotBeUndone')}` : undefined}
        confirmLabel={t('pond.archive')}
        onCancel={() => setShowArchivePondConfirm(false)}
        onConfirm={() => void confirmArchivePond()}
      />

      {showMoreActions ? (
        <button
          type="button"
          onClick={() => setShowMoreActions(false)}
          className="fixed inset-0 z-10 cursor-default bg-transparent"
          aria-label={t('pond.closePondMenu')}
        />
      ) : null}

      {cycleDialog ? (
        <div className="overlay-fade fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 md:items-center md:p-4">
          <div className="sheet-up max-h-[88vh] w-full overflow-y-auto rounded-t-[16px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-strong)] md:modal-pop md:max-w-md md:rounded-[var(--radius-shell)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text)]">
                  {cycleDialog === 'start' ? t('pond.startNewCycle') : cycleDialog === 'close' ? t('pond.closeCycle') : t('pond.transferCycle')}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{pondName}</p>
              </div>
              <button type="button" onClick={() => setCycleDialog(null)} className={actionButtonClassName}>
                x
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {formError ? <p className="rounded-[var(--radius-control)] bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
              {cycleDialog === 'start' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.startDate')}</span>
                    <input type="date" value={startDraft.dateStart} onChange={(event) => setStartDraft((draft) => ({ ...draft, dateStart: event.target.value }))} className={fieldClassName} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.fishType')}</span>
                    <select value={startDraft.fishTypeId} onChange={(event) => setStartDraft((draft) => ({ ...draft, fishTypeId: event.target.value }))} className={fieldClassName}>
                      {fishTypeOptions.map((fish) => (
                        <option key={fish.fish_type_id} value={fish.fish_type_id}>
                          {fish.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.initialStock')}</span>
                    <input type="number" min="1" value={startDraft.initialStock} onChange={(event) => setStartDraft((draft) => ({ ...draft, initialStock: event.target.value }))} className={fieldClassName} />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.seedWeightOptional')}</span>
                      <input type="number" min="0" value={startDraft.avgSeedWeightG} onChange={(event) => setStartDraft((draft) => ({ ...draft, avgSeedWeightG: event.target.value }))} className={fieldClassName} />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.targetWeightOptional')}</span>
                      <input type="number" min="0" value={startDraft.targetWeightG} onChange={(event) => setStartDraft((draft) => ({ ...draft, targetWeightG: event.target.value }))} className={fieldClassName} />
                    </label>
                  </div>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.capitalOptional')}</span>
                    <input type="number" min="0" value={startDraft.capitalRp} onChange={(event) => setStartDraft((draft) => ({ ...draft, capitalRp: event.target.value }))} className={fieldClassName} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.description')}</span>
                    <textarea rows={2} value={startDraft.description} onChange={(event) => setStartDraft((draft) => ({ ...draft, description: event.target.value }))} className={`${fieldClassName} min-h-[72px]`} />
                  </label>
                </>
              ) : cycleDialog === 'close' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.closeDate')}</span>
                    <input type="date" value={closeDraft.dateEnd} onChange={(event) => setCloseDraft((draft) => ({ ...draft, dateEnd: event.target.value }))} className={fieldClassName} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.reason')}</span>
                    <textarea rows={3} value={closeDraft.reason} onChange={(event) => setCloseDraft((draft) => ({ ...draft, reason: event.target.value }))} className={`${fieldClassName} min-h-[88px]`} placeholder="panen selesai, konsumsi pribadi, cleanup..." />
                  </label>
                </>
              ) : (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.transferDate')}</span>
                    <input type="date" value={transferDraft.date} onChange={(event) => setTransferDraft((draft) => ({ ...draft, date: event.target.value }))} className={fieldClassName} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.targetPond')}</span>
                    <select value={transferDraft.toUnitId} onChange={(event) => setTransferDraft((draft) => ({ ...draft, toUnitId: event.target.value }))} className={fieldClassName}>
                      {transferTargetOptions.map((pond) => (
                        <option key={pond.pond_id} value={pond.pond_id}>
                          {pond.pond_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.reason')}</span>
                    <textarea rows={3} value={transferDraft.reason} onChange={(event) => setTransferDraft((draft) => ({ ...draft, reason: event.target.value }))} className={`${fieldClassName} min-h-[88px]`} />
                  </label>
                </>
              )}

              <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                <button type="button" onClick={() => setCycleDialog(null)} className={actionButtonClassName}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={isMutating || (cycleDialog === 'start' && (!startDraft.fishTypeId || !startDraft.initialStock)) || (cycleDialog === 'transfer' && !transferDraft.toUnitId)}
                  onClick={() => {
                    if (cycleDialog === 'close') {
                      if (!closeDraft.dateEnd || !closeDraft.reason.trim()) {
                        setFormError(t('pond.closeRequired'))
                        showToast(t('common.validationFailed'), 'error', t('pond.closeRequired'))
                        return
                      }
                      setShowCloseConfirm(true)
                      return
                    }
                    void (cycleDialog === 'start' ? submitStartCycle() : submitTransferCycle())
                  }}
                  className={`${cycleDialog === 'close' ? 'inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-rose-600 px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-rose-700 active:scale-95' : primaryButtonClassName} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isMutating ? t('settings.saving') : cycleDialog === 'start' ? t('pond.startNewCycle') : cycleDialog === 'close' ? t('pond.closeCycle') : t('pond.transferCycle')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedLog ? (
        <div className="overlay-fade fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 md:items-center md:p-4">
          <div className="sheet-up max-h-[88vh] w-full overflow-y-auto rounded-t-[16px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-strong)] md:modal-pop md:max-w-md md:rounded-[var(--radius-shell)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text)]">{t('pond.editDailyLog')}</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{pondName}</p>
              </div>
              <button type="button" onClick={() => setLogEditId(null)} className={actionButtonClassName}>
                x
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {formError ? <p className="rounded-[var(--radius-control)] bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.date')}</span>
                <input type="date" value={logDraft.date} onChange={(event) => setLogDraft((draft) => ({ ...draft, date: event.target.value }))} className={fieldClassName} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.feed')} (g)</span>
                <input type="number" min="0" value={logDraft.feedG} onChange={(event) => setLogDraft((draft) => ({ ...draft, feedG: event.target.value }))} className={fieldClassName} />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.sampleWeight')} (g)</span>
                  <input type="number" min="0" value={logDraft.sampleWeightG} onChange={(event) => setLogDraft((draft) => ({ ...draft, sampleWeightG: event.target.value }))} className={fieldClassName} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.sampleCount')}</span>
                  <input type="number" min="0" value={logDraft.sampleCount} onChange={(event) => setLogDraft((draft) => ({ ...draft, sampleCount: event.target.value }))} className={fieldClassName} />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.event')}</span>
                <input value={logDraft.event} onChange={(event) => setLogDraft((draft) => ({ ...draft, event: event.target.value }))} className={fieldClassName} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.action')}</span>
                <input value={logDraft.action} onChange={(event) => setLogDraft((draft) => ({ ...draft, action: event.target.value }))} className={fieldClassName} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.description')}</span>
                <textarea rows={3} value={logDraft.description} onChange={(event) => setLogDraft((draft) => ({ ...draft, description: event.target.value }))} className={`${fieldClassName} min-h-[88px]`} />
              </label>
              <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                <button type="button" onClick={() => setLogEditId(null)} className={actionButtonClassName}>
                  {t('common.cancel')}
                </button>
                <button type="button" disabled={isMutating} onClick={() => void saveLogEdit()} className={`${primaryButtonClassName} disabled:cursor-not-allowed disabled:opacity-60`}>
                  {isMutating ? t('common.saving') : t('pond.updateLog')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DangerConfirmModal
        open={showCloseConfirm}
        title={t('pond.closeCycle')}
        message={t('pond.closeCycleWarning')}
        detail={`${pondName}. ${t('pond.reason')}: ${closeDraft.reason || '-'}`}
        confirmLabel={isMutating ? t('common.saving') : t('pond.closeCycle')}
        onCancel={() => setShowCloseConfirm(false)}
        onConfirm={() => void submitCloseCycle()}
      />

      <DangerConfirmModal
        open={Boolean(deleteLog)}
        title={t('pond.deleteDailyLog')}
        message={t('pond.deleteDailyLogMessage')}
        detail={deleteLog ? `${pondName} - ${formatDate(deleteLog.date)}. ${t('common.cannotBeUndone')}` : undefined}
        confirmLabel={isMutating ? t('common.deleting') : t('common.delete')}
        onCancel={() => setDeleteLogId(null)}
        onConfirm={() => void confirmDeleteLog()}
      />

      <DangerConfirmModal
        open={Boolean(deleteMovement)}
        title={t('pond.deleteStockMovement')}
        message={t('pond.deleteStockMovementMessage')}
        detail={deleteMovement ? `${pondName} - ${formatDate(deleteMovement.date)} - ${deleteMovement.movement_label}. ${t('common.cannotBeUndone')}` : undefined}
        confirmLabel={isMutating ? t('common.deleting') : t('common.delete')}
        onCancel={() => setDeleteMovementId(null)}
        onConfirm={() => void confirmDeleteMovement()}
      />
    </div>
  )
}
