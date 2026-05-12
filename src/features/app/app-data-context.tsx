import { createContext, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { loadFromStorage, saveToStorage } from '../../lib/local-storage'
import { seedSnapshot } from '../../lib/seed-data'
import { getCycleMovementTotals } from '../../lib/stock'
import type {
  CashEntry,
  CashEntryInput,
  CloseCycleInput,
  Cycle,
  DailyLogInput,
  DashboardSummary,
  DataSnapshot,
  Sale,
  SaleInput,
  TransferCycleInput,
} from '../../types/domain'
import { useAuth } from '../auth/auth-context'

interface AppDataContextValue {
  snapshot: DataSnapshot
  version: number
  getDashboardSummary: () => DashboardSummary
  getCurrentCycleForPond: (unitId: string) => Cycle | undefined
  addDailyLog: (input: DailyLogInput) => void
  updateDailyLog: (id: string, input: DailyLogInput) => void
  deleteDailyLog: (id: string) => void
  addStockMovement: (input: {
    date: string
    unitId: string
    cycleId: string
    fishType: string
    movementType:
      | 'stock_in'
      | 'died'
      | 'sold'
      | 'transfer_out'
      | 'transfer_in'
      | 'personal_use'
      | 'adjustment_out'
      | 'adjustment_in'
    count: number
    weightKg: number | null
    description: string
  }) => void
  deleteStockMovement: (id: string) => void
  addSale: (input: SaleInput) => { warning: string | null }
  deleteSale: (id: string) => void
  addCashEntry: (input: CashEntryInput) => void
  updateCashEntry: (id: string, input: CashEntryInput) => void
  deleteCashEntry: (id: string) => void
  closeCycle: (input: CloseCycleInput) => void
  transferCycle: (input: TransferCycleInput) => void
  updateCurrentProfile: (language: 'id' | 'en', telegramId: string) => void
}

const STORAGE_KEY = 'kanikan-web-data'
const AppDataContext = createContext<AppDataContextValue | null>(null)

const getToday = () => new Date().toISOString().slice(0, 10)
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const normalizeSnapshot = (raw: DataSnapshot): DataSnapshot => {
  const source = raw as DataSnapshot & {
    kasCategories?: DataSnapshot['kasCategories']
    ponds?: Array<DataSnapshot['ponds'][number] & { notes?: string }>
    cycles?: Array<DataSnapshot['cycles'][number] & { notes?: string }>
    dailyLogs?: Array<DataSnapshot['dailyLogs'][number] & { notes?: string }>
    stockMovements?: Array<DataSnapshot['stockMovements'][number] & { notes?: string }>
    cashEntries?: Array<DataSnapshot['cashEntries'][number] & { category?: string; notes?: string }>
  }

  const kasCategories = source.kasCategories ?? seedSnapshot.kasCategories
  const getCategoryId = (type: CashEntry['type'], legacyCategory?: string) =>
    kasCategories.find((category) => category.type === type && category.name === legacyCategory)?.id ??
    kasCategories.find((category) => category.type === type)?.id ??
    ''

  return {
    ...seedSnapshot,
    ...source,
    kasCategories,
    ponds: (source.ponds ?? seedSnapshot.ponds).map((pond) => {
      const legacy = pond as typeof pond & { notes?: string }
      return {
        ...pond,
        description: pond.description ?? legacy.notes ?? '',
      }
    }),
    cycles: (source.cycles ?? seedSnapshot.cycles).map((cycle) => {
      const legacy = cycle as typeof cycle & { notes?: string }
      return {
        ...cycle,
        description: cycle.description ?? legacy.notes ?? '',
      }
    }),
    dailyLogs: (source.dailyLogs ?? seedSnapshot.dailyLogs).map((log) => {
      const legacy = log as typeof log & { notes?: string }
      return {
        ...log,
        description: log.description ?? legacy.notes ?? log.event ?? log.action ?? '',
      }
    }),
    stockMovements: (source.stockMovements ?? seedSnapshot.stockMovements).map((movement) => {
      const legacy = movement as typeof movement & { notes?: string }
      return {
        ...movement,
        description: movement.description ?? legacy.notes ?? '',
      }
    }),
    cashEntries: (source.cashEntries ?? seedSnapshot.cashEntries).map((entry) => {
      const legacy = entry as typeof entry & { category?: string; notes?: string }
      return {
        ...entry,
        categoryId: entry.categoryId ?? getCategoryId(entry.type, legacy.category),
        description: entry.description ?? legacy.notes ?? '',
      }
    }),
  }
}

const getCategoryIdForType = (snapshot: DataSnapshot, type: CashEntry['type'], name: string) =>
  snapshot.kasCategories.find((category) => category.type === type && category.name === name)?.id ??
  snapshot.kasCategories.find((category) => category.type === type)?.id ??
  seedSnapshot.kasCategories.find((category) => category.type === type && category.name === name)?.id ??
  ''

export const AppDataProvider = ({ children }: PropsWithChildren) => {
  const auth = useAuth()
  const [snapshot, setSnapshot] = useState<DataSnapshot>(() =>
    normalizeSnapshot(loadFromStorage<DataSnapshot>(STORAGE_KEY, seedSnapshot)),
  )
  const [version, setVersion] = useState(0)

  const updateSnapshot = (updater: (current: DataSnapshot) => DataSnapshot) => {
    setSnapshot((current) => {
      const next = updater(current)
      saveToStorage(STORAGE_KEY, next)
      setVersion((value) => value + 1)
      return next
    })
  }

  const getCurrentCycleForPond = (unitId: string) =>
    snapshot.cycles.find((cycle) => cycle.unitId === unitId && cycle.dateEnd === null)

  const getDashboardSummary = (): DashboardSummary => {
    const today = getToday()
    const activePonds = snapshot.ponds.filter((pond) => pond.isActive).length
    const activeCycles = snapshot.cycles.filter((cycle) => cycle.dateEnd === null).length
    const liveFishBySpecies = Array.from(
      snapshot.cycles.reduce((map, cycle) => {
        const alive = getCycleMovementTotals(cycle.id, snapshot.stockMovements).alive
        map.set(cycle.fishType, (map.get(cycle.fishType) ?? 0) + alive)
        return map
      }, new Map<string, number>()),
    ).map(([species, alive]) => ({ species, alive }))

    const feedTodayG = snapshot.dailyLogs
      .filter((log) => log.date === today)
      .reduce((sum, log) => sum + log.feedG, 0)

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)

    const diedThisWeek = snapshot.stockMovements
      .filter((movement) => movement.movementType === 'died' && new Date(movement.date) >= weekStart)
      .reduce((sum, movement) => sum + movement.count, 0)

    const currentMonth = today.slice(0, 7)
    const salesThisMonthRp = snapshot.sales
      .filter((sale) => sale.date.startsWith(currentMonth))
      .reduce((sum, sale) => sum + sale.totalRp, 0)

    const cashBalanceRp = snapshot.cashEntries.reduce(
      (sum, entry) => sum + (entry.type === 'Masuk' ? entry.amountRp : -entry.amountRp),
      0,
    )

    const pondsMissingLog = snapshot.ponds.filter((pond) => {
      const cycle = getCurrentCycleForPond(pond.id)
      if (!cycle) return false
      return !snapshot.dailyLogs.some((log) => log.unitId === pond.id && log.date === today)
    })

    const cyclesMissingTarget = snapshot.cycles.filter(
      (cycle) => cycle.dateEnd === null && cycle.targetWeightG === null,
    )

    const stockAnomalyCount = snapshot.cycles.filter(
      (cycle) => getCycleMovementTotals(cycle.id, snapshot.stockMovements).alive < 0,
    ).length

    const alerts = [
      ...pondsMissingLog.slice(0, 2).map((pond) => ({
        id: `missing-log-${pond.id}`,
        tone: 'warning' as const,
        title: `${pond.name} belum log hari ini`,
        description: 'Periksa operasional harian dan update log.',
      })),
      ...cyclesMissingTarget.slice(0, 2).map((cycle) => ({
        id: `missing-target-${cycle.id}`,
        tone: 'info' as const,
        title: `${cycle.name} belum punya target panen`,
        description: 'Prediction page akan kosong sampai target diisi.',
      })),
    ]

    if (stockAnomalyCount > 0) {
      alerts.push({
        id: 'stock-anomaly',
        tone: 'warning',
        title: 'Anomali stok terdeteksi',
        description: 'Periksa stock movement ledger dan lakukan reconciliation.',
      })
    }

    return {
      activePonds,
      activeCycles,
      liveFishBySpecies,
      feedTodayG,
      diedThisWeek,
      salesThisMonthRp,
      cashBalanceRp,
      pondsMissingLog,
      cyclesMissingTarget,
      stockAnomalyCount,
      alerts,
    }
  }

  const addDailyLog = (input: DailyLogInput) => {
    updateSnapshot((current) => ({
      ...current,
      dailyLogs: [
        {
          id: newId('log'),
          ...input,
          createdBy: auth.profile?.id ?? current.profiles[0].id,
        },
        ...current.dailyLogs,
      ],
    }))
  }

  const deleteDailyLog = (id: string) => {
    updateSnapshot((current) => ({
      ...current,
      dailyLogs: current.dailyLogs.filter((log) => log.id !== id),
    }))
  }

  const updateDailyLog = (id: string, input: DailyLogInput) => {
    updateSnapshot((current) => ({
      ...current,
      dailyLogs: current.dailyLogs.map((log) =>
        log.id === id
          ? {
              ...log,
              ...input,
            }
          : log,
      ),
    }))
  }

  const addStockMovement: AppDataContextValue['addStockMovement'] = (input) => {
    updateSnapshot((current) => ({
      ...current,
      stockMovements: [
        {
          id: newId('movement'),
          ...input,
          meta: { source: 'manual_ui' },
          sourceTable: 'manual_ui',
          sourceRowId: null,
          createdBy: auth.profile?.id ?? current.profiles[0].id,
          createdAt: new Date().toISOString(),
        },
        ...current.stockMovements,
      ],
    }))
  }

  const deleteStockMovement = (id: string) => {
    updateSnapshot((current) => ({
      ...current,
      stockMovements: current.stockMovements.filter((movement) => movement.id !== id),
    }))
  }

  const addSale = (input: SaleInput) => {
    let warning: string | null = null

    updateSnapshot((current) => {
      const saleId = newId('sale')
      const totalRp = input.weightKg * input.pricePerKg
      const stockReduced = Boolean(input.soldCount && input.soldCount > 0)
      if (!stockReduced) {
        warning = 'Stok ekor belum berkurang karena sold count belum tersedia atau belum bisa diestimasi.'
      }

      const nextSales: Sale[] = [
        {
          id: saleId,
          ...input,
          totalRp,
          createdBy: auth.profile?.id ?? current.profiles[0].id,
          stockReduced,
        },
        ...current.sales,
      ]

      const nextCash: CashEntry[] = [
        {
          id: newId('cash'),
          date: input.date,
          type: 'Masuk',
          categoryId: getCategoryIdForType(current, 'Masuk', 'Penjualan'),
          description: `Auto cash from sale - ${input.fishType} | Note: ${input.buyer}`,
          cycleId: input.cycleId,
          amountRp: totalRp,
          createdBy: auth.profile?.id ?? current.profiles[0].id,
          sourceSaleId: saleId,
        },
        ...current.cashEntries,
      ]

      const nextMovements = stockReduced
        ? [
            {
              id: newId('movement'),
              date: input.date,
              unitId: input.unitId,
              cycleId: input.cycleId,
              fishType: input.fishType,
              movementType: 'sold' as const,
              count: input.soldCount ?? 0,
              weightKg: input.weightKg,
              description: `[UI] sale for ${input.buyer}`,
              meta: {
                soldCountSource: input.soldCountSource ?? 'unknown',
              },
              sourceTable: 'penjualan',
              sourceRowId: saleId,
              createdBy: auth.profile?.id ?? current.profiles[0].id,
              createdAt: new Date().toISOString(),
            },
            ...current.stockMovements,
          ]
        : current.stockMovements

      return {
        ...current,
        sales: nextSales,
        cashEntries: nextCash,
        stockMovements: nextMovements,
      }
    })

    return { warning }
  }

  const deleteSale = (id: string) => {
    updateSnapshot((current) => ({
      ...current,
      sales: current.sales.filter((sale) => sale.id !== id),
      cashEntries: current.cashEntries.filter((entry) => entry.sourceSaleId !== id),
      stockMovements: current.stockMovements.filter(
        (movement) => !(movement.sourceTable === 'penjualan' && movement.sourceRowId === id),
      ),
    }))
  }

  const addCashEntry = (input: CashEntryInput) => {
    updateSnapshot((current) => ({
      ...current,
      cashEntries: [
        {
          id: newId('cash'),
          ...input,
          createdBy: auth.profile?.id ?? current.profiles[0].id,
          sourceSaleId: null,
        },
        ...current.cashEntries,
      ],
    }))
  }

  const updateCashEntry = (id: string, input: CashEntryInput) => {
    updateSnapshot((current) => ({
      ...current,
      cashEntries: current.cashEntries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...input,
            }
          : entry,
      ),
    }))
  }

  const deleteCashEntry = (id: string) => {
    updateSnapshot((current) => ({
      ...current,
      cashEntries: current.cashEntries.filter((entry) => entry.id !== id),
    }))
  }

  const closeCycle = (input: CloseCycleInput) => {
    updateSnapshot((current) => {
      const cycle = current.cycles.find((item) => item.id === input.cycleId)
      if (!cycle) return current
      const alive = getCycleMovementTotals(cycle.id, current.stockMovements).alive
      const movementType = /konsumsi|personal/i.test(input.reason)
        ? ('personal_use' as const)
        : ('adjustment_out' as const)

      const nextMovements =
        alive > 0
          ? [
              {
                id: newId('movement'),
                date: input.dateEnd,
                unitId: cycle.unitId,
                cycleId: cycle.id,
                fishType: cycle.fishType,
                movementType,
                count: alive,
                weightKg: null,
                description: `[UI] close cycle reason=${input.reason}`,
                meta: { reason: input.reason },
                sourceTable: 'manual_cycle_close',
                sourceRowId: cycle.id,
                createdBy: auth.profile?.id ?? current.profiles[0].id,
                createdAt: new Date().toISOString(),
              },
              ...current.stockMovements,
            ]
          : current.stockMovements

      return {
        ...current,
        cycles: current.cycles.map((item) =>
          item.id === input.cycleId
            ? { ...item, dateEnd: input.dateEnd, description: `${item.description}\nClosed: ${input.reason}`.trim() }
            : item,
        ),
        stockMovements: nextMovements,
      }
    })
  }

  const transferCycle = (input: TransferCycleInput) => {
    updateSnapshot((current) => {
      const cycle = current.cycles.find((item) => item.id === input.cycleId)
      const target = current.ponds.find((item) => item.id === input.toUnitId)
      if (!cycle || !target) return current
      const alive = Math.max(getCycleMovementTotals(cycle.id, current.stockMovements).alive, 0)
      const activeTargetCycle = current.cycles.find(
        (item) => item.unitId === input.toUnitId && item.dateEnd === null,
      )
      if (activeTargetCycle) return current

      const newCycleId = newId('cycle')
      return {
        ...current,
        cycles: [
          {
            ...cycle,
            id: newCycleId,
            name: `${cycle.name} - Transfer`,
            unitId: input.toUnitId,
            dateStart: input.dateEnd,
            dateEnd: null,
            initialStock: alive,
            description: `Transfer continuation from ${cycle.name}. Reason: ${input.reason}`,
          },
          ...current.cycles.map((item) =>
            item.id === cycle.id
              ? { ...item, dateEnd: input.dateEnd, description: `${item.description}\nTransferred to ${target.name}: ${input.reason}`.trim() }
              : item,
          ),
        ],
        stockMovements: [
          {
            id: newId('movement'),
            date: input.dateEnd,
            unitId: input.toUnitId,
            cycleId: newCycleId,
            fishType: cycle.fishType,
            movementType: 'transfer_in',
            count: alive,
            weightKg: null,
            description: `[UI] transfer in from ${cycle.unitId}`,
            meta: { reason: input.reason, fromCycleId: cycle.id },
            sourceTable: 'transfer_ui',
            sourceRowId: cycle.id,
            createdBy: auth.profile?.id ?? current.profiles[0].id,
            createdAt: new Date().toISOString(),
          },
          {
            id: newId('movement'),
            date: input.dateEnd,
            unitId: cycle.unitId,
            cycleId: cycle.id,
            fishType: cycle.fishType,
            movementType: 'transfer_out',
            count: alive,
            weightKg: null,
            description: `[UI] transfer out to ${target.name}`,
            meta: { reason: input.reason, toUnitId: input.toUnitId },
            sourceTable: 'transfer_ui',
            sourceRowId: cycle.id,
            createdBy: auth.profile?.id ?? current.profiles[0].id,
            createdAt: new Date().toISOString(),
          },
          ...current.stockMovements,
        ],
      }
    })
  }

  const updateCurrentProfile = (language: 'id' | 'en', telegramId: string) => {
    if (!auth.profile) return
    auth.updateLocalProfile((profile) => ({ ...profile, language, telegramId }))
    updateSnapshot((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === auth.profile?.id ? { ...profile, language, telegramId } : profile,
      ),
    }))
  }

  const value = useMemo<AppDataContextValue>(
    () => ({
      snapshot,
      version,
      getDashboardSummary,
      getCurrentCycleForPond,
      addDailyLog,
      updateDailyLog,
      deleteDailyLog,
      addStockMovement,
      deleteStockMovement,
      addSale,
      deleteSale,
      addCashEntry,
      updateCashEntry,
      deleteCashEntry,
      closeCycle,
      transferCycle,
      updateCurrentProfile,
    }),
    [snapshot, version, auth.profile],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export const useAppData = () => {
  const context = useContext(AppDataContext)
  if (!context) throw new Error('useAppData must be used within AppDataProvider')
  return context
}
