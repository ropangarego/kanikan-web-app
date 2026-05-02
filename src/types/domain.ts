export type Role = 'owner' | 'member'
export type Language = 'id' | 'en'
export type CashType = 'Masuk' | 'Keluar'

export type StockMovementType =
  | 'stock_in'
  | 'died'
  | 'sold'
  | 'transfer_out'
  | 'transfer_in'
  | 'personal_use'
  | 'adjustment_out'
  | 'adjustment_in'

export interface Profile {
  id: string
  fullName: string
  email: string
  role: Role
  language: Language
  telegramId: string
}

export interface Pond {
  id: string
  name: string
  type: string
  capacity: number
  isActive: boolean
  description: string
}

export interface Cycle {
  id: string
  name: string
  unitId: string
  fishType: string
  dateStart: string
  dateEnd: string | null
  initialStock: number
  avgSeedWeightG: number
  targetWeightG: number | null
  capitalRp: number
  description: string
}

export interface DailyLog {
  id: string
  date: string
  unitId: string
  cycleId: string
  fishType: string
  feedG: number
  event: string
  action: string
  description: string
  sampleWeightG: number | null
  sampleCount: number | null
  createdBy: string
}

export interface StockMovement {
  id: string
  date: string
  unitId: string
  cycleId: string
  fishType: string
  movementType: StockMovementType
  count: number
  weightKg: number | null
  description: string
  meta: Record<string, string | number | boolean | null>
  sourceTable: string | null
  sourceRowId: string | null
  createdBy: string
  createdAt: string
}

export interface Sale {
  id: string
  date: string
  unitId: string
  cycleId: string
  fishType: string
  weightKg: number
  pricePerKg: number
  totalRp: number
  buyer: string
  soldCount: number | null
  soldCountSource: 'manual' | 'estimated' | null
  avgWeightUsedG: number | null
  createdBy: string
  stockReduced: boolean
}

export interface CashEntry {
  id: string
  date: string
  type: CashType
  categoryId: string
  description: string | null
  cycleId: string | null
  amountRp: number
  createdBy: string
  sourceSaleId: string | null
}

export interface KasCategory {
  id: string
  type: CashType
  name: string
  sortOrder: number
}

export interface DashboardAlert {
  id: string
  tone: 'warning' | 'info' | 'success'
  title: string
  description: string
}

export interface DashboardSummary {
  activePonds: number
  activeCycles: number
  liveFishBySpecies: Array<{ species: string; alive: number }>
  feedTodayG: number
  diedThisWeek: number
  salesThisMonthRp: number
  cashBalanceRp: number
  pondsMissingLog: Pond[]
  cyclesMissingTarget: Cycle[]
  stockAnomalyCount: number
  alerts: DashboardAlert[]
}

export interface DataSnapshot {
  profiles: Profile[]
  ponds: Pond[]
  cycles: Cycle[]
  dailyLogs: DailyLog[]
  stockMovements: StockMovement[]
  sales: Sale[]
  cashEntries: CashEntry[]
  kasCategories: KasCategory[]
}

export interface DailyLogInput {
  date: string
  unitId: string
  cycleId: string
  fishType: string
  feedG: number
  event: string
  action: string
  description: string
  sampleWeightG: number | null
  sampleCount: number | null
}

export interface StockMovementInput {
  date: string
  unitId: string
  cycleId: string
  fishType: string
  movementType: StockMovementType
  count: number
  weightKg: number | null
  description: string
}

export interface SaleInput {
  date: string
  unitId: string
  cycleId: string
  fishType: string
  weightKg: number
  pricePerKg: number
  buyer: string
  soldCount: number | null
  soldCountSource: 'manual' | 'estimated' | null
  avgWeightUsedG: number | null
}

export interface CashEntryInput {
  date: string
  type: CashType
  categoryId: string
  description: string | null
  cycleId: string | null
  amountRp: number
}

export interface CloseCycleInput {
  cycleId: string
  dateEnd: string
  reason: string
}

export interface TransferCycleInput {
  cycleId: string
  toUnitId: string
  dateEnd: string
  reason: string
}
