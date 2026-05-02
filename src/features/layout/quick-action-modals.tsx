import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createCashTransaction, createDailyLog, createStockMovement, usePondsListQuery } from '../../lib/api'
import { translate, useAppLanguage } from '../../lib/i18n'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useAppData } from '../app/app-data-context'
import { useAuth } from '../auth/auth-context'
import { useToast } from '../feedback/toast-provider'

export type QuickActionType = 'log' | 'stock' | 'cash'

export type QuickActionState = {
  type: QuickActionType
  pondId?: string
}

export const quickActionEventName = 'kanikan:open-quick-action'

type QuickActionEvent = CustomEvent<QuickActionState>

export const openQuickAction = (detail: QuickActionState) => {
  window.dispatchEvent(new CustomEvent(quickActionEventName, { detail }) as QuickActionEvent)
}

const getToday = () => new Date().toISOString().slice(0, 10)
const getYesterday = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().slice(0, 10)
}

const fieldClassName =
  'w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]'

const secondaryButtonClassName =
  'inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-surface-muted)] active:scale-95'

const primaryButtonClassName =
  'inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'

const suggestionButtonClassName =
  'cursor-pointer text-xs font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-primary)] active:scale-[0.98]'

const DateField = ({
  value,
  onChange,
  t,
}: {
  value: string
  onChange: (value: string) => void
  t: (key: Parameters<typeof translate>[1]) => string
}) => (
  <div className="space-y-2">
    <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.date')}</span>
    <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className={fieldClassName} />
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-[var(--color-text-muted)]">{t('common.suggested')}</span>
      <button type="button" onClick={() => onChange(getToday())} className={suggestionButtonClassName}>
        {t('common.today')}
      </button>
      <span className="text-xs font-medium text-[var(--color-text-muted)]">&middot;</span>
      <button type="button" onClick={() => onChange(getYesterday())} className={suggestionButtonClassName}>
        {t('common.yesterday')}
      </button>
    </div>
  </div>
)

export const QuickActionModal = ({
  action,
  onClose,
}: {
  action: QuickActionState | null
  onClose: () => void
}) => {
  const auth = useAuth()
  const appData = useAppData()
  const { showToast } = useToast()
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const queryClient = useQueryClient()
  const pondsListQuery = usePondsListQuery({ include_inactive: true })
  const pondOptions = useMemo(
    () =>
      (
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
        .sort((left, right) => Number(right.hasCycle) - Number(left.hasCycle) || left.name.localeCompare(right.name)),
    [appData, pondsListQuery.data?.ponds],
  )

  const defaultPondId = useMemo(() => {
    if (action?.pondId) return action.pondId
    return pondOptions.find((pond) => pond.hasCycle)?.id ?? pondOptions[0]?.id ?? ''
  }, [action?.pondId, pondOptions])

  const [date, setDate] = useState(getToday())
  const [pondId, setPondId] = useState(defaultPondId)
  const [feedG, setFeedG] = useState('1000')
  const [logDescription, setLogDescription] = useState('')
  const [sampleWeightG, setSampleWeightG] = useState('')
  const [sampleCount, setSampleCount] = useState('')
  const [stockType, setStockType] = useState<'in' | 'sold' | 'died' | 'adjustment'>('in')
  const [stockCount, setStockCount] = useState('')
  const [stockWeightKg, setStockWeightKg] = useState('')
  const [stockDescription, setStockDescription] = useState('')
  const [cashType, setCashType] = useState<'Masuk' | 'Keluar'>('Keluar')
  const [cashCategoryId, setCashCategoryId] = useState('cash-cat-feed')
  const [cashAmount, setCashAmount] = useState('')
  const [cashDescription, setCashDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!action) return
    setDate(getToday())
    setPondId(defaultPondId)
    setFeedG('1000')
    setLogDescription('')
    setSampleWeightG('')
    setSampleCount('')
    setStockType('in')
    setStockCount('')
    setStockWeightKg('')
    setStockDescription('')
    setCashType('Keluar')
    setCashCategoryId(appData.snapshot.kasCategories.find((category) => category.type === 'Keluar')?.id ?? '')
    setCashAmount('')
    setCashDescription('')
    setFormError(null)
  }, [action, defaultPondId, appData.snapshot.kasCategories])

  if (!action) return null

  const selectedPondOption = pondOptions.find((pond) => pond.id === pondId)
  const selectedLocalCycle = appData.getCurrentCycleForPond(pondId)
  const selectedCycle = selectedLocalCycle
    ? { id: selectedLocalCycle.id, fishType: selectedLocalCycle.fishType }
    : selectedPondOption?.hasCycle && selectedPondOption.cycleId && selectedPondOption.fishType
      ? { id: selectedPondOption.cycleId, fishType: selectedPondOption.fishType }
      : undefined
  const cashCategoryOptions = appData.snapshot.kasCategories
    .filter((category) => category.type === cashType)
    .sort((left, right) => left.sortOrder - right.sortOrder)

  const refreshOperationalQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['read-api', 'dashboard-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'ponds-list'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'pond-detail'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'stock-movements'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'cash-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['read-api', 'cash-transactions'] }),
    ])
  }

  const saveLog = async () => {
    if (!selectedCycle) {
      showToast(t('quick.noActiveCycleSave'), 'error', t('quick.noActiveCycleDesc'))
      return
    }
    if (!date || Number(feedG) < 0 || (sampleWeightG && Number(sampleWeightG) < 0) || (sampleCount && Number(sampleCount) < 0)) {
      setFormError(t('quick.dateAndNonNegative'))
      showToast(t('common.validationFailed'), 'error', t('pond.checkDailyLogForm'))
      return
    }
    setFormError(null)

    try {
      if (isSupabaseConfigured) {
        await createDailyLog({
          date,
          unitId: pondId,
          feedG: Number(feedG || 0),
          description: logDescription,
          sampleWeightG: sampleWeightG ? Number(sampleWeightG) : null,
          sampleCount: sampleCount ? Number(sampleCount) : null,
        })
        await refreshOperationalQueries()
      } else {
        appData.addDailyLog({
          date,
          unitId: pondId,
          cycleId: selectedCycle.id,
          fishType: selectedCycle.fishType,
          feedG: Number(feedG || 0),
          event: '',
          action: '',
          description: logDescription,
          sampleWeightG: sampleWeightG ? Number(sampleWeightG) : null,
          sampleCount: sampleCount ? Number(sampleCount) : null,
        })
      }
      showToast(t('quick.logSaved'), 'success', t('quick.logSavedDesc'))
      onClose()
    } catch {
      showToast(t('cash.couldNotSave'), 'error', t('cash.checkConnection'))
    }
  }

  const saveStock = async () => {
    if (!selectedCycle) {
      showToast(t('quick.noActiveCycleSave'), 'error', t('quick.noActiveCycleDesc'))
      return
    }
    if (!date || Number(stockCount || 0) <= 0 || Number(stockWeightKg || 0) < 0) {
      setFormError(t('quick.stockRequired'))
      showToast(t('common.validationFailed'), 'error', t('stock.formCheck'))
      return
    }
    setFormError(null)

    const movementType =
      stockType === 'in'
        ? 'stock_in'
        : stockType === 'sold'
          ? 'sold'
          : stockType === 'died'
            ? 'died'
            : 'adjustment_out'

    try {
      if (isSupabaseConfigured) {
        await createStockMovement({
          date,
          unitId: pondId,
          movementType,
          count: Number(stockCount || 0),
          weightKg: stockWeightKg ? Number(stockWeightKg) : null,
          description: stockDescription,
        })
        await refreshOperationalQueries()
      } else {
        appData.addStockMovement({
          date,
          unitId: pondId,
          cycleId: selectedCycle.id,
          fishType: selectedCycle.fishType,
          movementType,
          count: Number(stockCount || 0),
          weightKg: stockWeightKg ? Number(stockWeightKg) : null,
          description: stockDescription,
        })
      }
      showToast(t('quick.stockSaved'), 'success', t('quick.stockSavedDesc'))
      onClose()
    } catch {
      showToast(t('cash.couldNotSave'), 'error', t('quick.stockSaveDesc'))
    }
  }

  const saveCash = async () => {
    if (!date || !cashCategoryId || Number(cashAmount || 0) <= 0) {
      setFormError(t('quick.cashRequired'))
      showToast(t('common.validationFailed'), 'error', t('cash.checkForm'))
      return
    }
    setFormError(null)
    try {
      if (isSupabaseConfigured) {
        await createCashTransaction({
          date,
          type: cashType,
          categoryId: cashCategoryId,
          amountRp: Number(cashAmount || 0),
          description: cashDescription,
          cycleId: null,
        })
        await refreshOperationalQueries()
      } else {
        appData.addCashEntry({
          date,
          type: cashType,
          categoryId: cashCategoryId,
          amountRp: Number(cashAmount || 0),
          description: cashDescription,
          cycleId: null,
        })
      }
      showToast(t('quick.cashSaved'), 'success', t('quick.cashSavedDesc'))
      onClose()
    } catch {
      showToast(t('cash.couldNotSave'), 'error', t('cash.checkConnection'))
    }
  }

  const title = action.type === 'log' ? t('pond.addLog') : action.type === 'stock' ? t('stock.updateStock') : t('cash.addTransaction')

  return (
    <div className="overlay-fade fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/40 p-0 md:items-center md:p-4">
      <div className="sheet-up max-h-[88vh] w-full overflow-y-auto rounded-t-[16px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-strong)] md:modal-pop md:max-h-[90vh] md:max-w-md md:rounded-[var(--radius-shell)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">{title}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('quick.operationalData')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-muted)] transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-95"
          >
            x
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {formError ? <p className="rounded-[var(--radius-control)] bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
          {action.type === 'cash' ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <DateField value={date} onChange={setDate} t={t} />
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('cash.typeLabel')}</span>
                  <select
                    value={cashType}
                    onChange={(event) => {
                      const nextType = event.target.value as 'Masuk' | 'Keluar'
                      const nextCategory = appData.snapshot.kasCategories.find((category) => category.type === nextType)
                      setCashType(nextType)
                      setCashCategoryId(nextCategory?.id ?? '')
                    }}
                    className={fieldClassName}
                  >
                    <option value="Masuk">Masuk</option>
                    <option value="Keluar">Keluar</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.category')}</span>
                  <select value={cashCategoryId} onChange={(event) => setCashCategoryId(event.target.value)} className={fieldClassName}>
                    {cashCategoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.amount')} (Rp)</span>
                  <input value={cashAmount} onChange={(event) => setCashAmount(Number(event.target.value) < 0 ? '' : event.target.value)} type="number" min="1" className={fieldClassName} />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.note')}</span>
                <textarea value={cashDescription} onChange={(event) => setCashDescription(event.target.value)} rows={2} className={`${fieldClassName} min-h-[72px] py-3`} />
              </label>
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <DateField value={date} onChange={setDate} t={t} />
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.pond')}</span>
                  <select value={pondId} onChange={(event) => setPondId(event.target.value)} className={fieldClassName}>
                    {pondOptions.map((pond) => (
                      <option key={pond.id} value={pond.id}>
                        {pond.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!selectedCycle ? (
                <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text-muted)]">
                  {t('quick.noActiveCycle')}
                </div>
              ) : null}
            </>
          )}

          {action.type === 'log' ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.feed')} (g)</span>
                  <input value={feedG} onChange={(event) => setFeedG(Number(event.target.value) < 0 ? '' : event.target.value)} type="number" min="0" className={fieldClassName} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('pond.sampleWeight')}</span>
                <input value={sampleWeightG} onChange={(event) => setSampleWeightG(Number(event.target.value) < 0 ? '' : event.target.value)} type="number" min="0" className={fieldClassName} placeholder="120 g" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.note')}</span>
                <textarea value={logDescription} onChange={(inputEvent) => setLogDescription(inputEvent.target.value)} rows={2} className={`${fieldClassName} min-h-[72px] py-3`} />
              </label>
            </>
          ) : null}

          {action.type === 'stock' ? (
            <>
              <div className="space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.type')}</span>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    { value: 'in' as const, label: t('stock.typeIn') },
                    { value: 'sold' as const, label: t('stock.typeSold') },
                    { value: 'died' as const, label: t('stock.typeDied') },
                    { value: 'adjustment' as const, label: t('stock.typeAdjustment') },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStockType(option.value)}
                      className={`min-h-9 rounded-[var(--radius-control)] border px-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                        stockType === option.value
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.count')}</span>
                  <input value={stockCount} onChange={(event) => setStockCount(Number(event.target.value) < 0 ? '' : event.target.value)} type="number" min="0" className={fieldClassName} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('stock.weight')} (kg)</span>
                  <input value={stockWeightKg} onChange={(event) => setStockWeightKg(Number(event.target.value) < 0 ? '' : event.target.value)} type="number" min="0" className={fieldClassName} />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.note')}</span>
                <textarea value={stockDescription} onChange={(event) => setStockDescription(event.target.value)} rows={2} className={`${fieldClassName} min-h-[72px] py-3`} />
              </label>
            </>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <button type="button" onClick={onClose} className={secondaryButtonClassName}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void (action.type === 'log' ? saveLog() : action.type === 'stock' ? saveStock() : saveCash())}
              disabled={(action.type === 'log' || action.type === 'stock') && !selectedCycle}
              className={primaryButtonClassName}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
