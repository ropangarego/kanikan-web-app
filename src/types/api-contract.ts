export type ApiId = string
export type ApiDate = string
export type ApiDateTime = string

export type PondStatus = 'active' | 'inactive'
export type CycleStatus = 'running' | 'closed'
export type CashType = 'Masuk' | 'Keluar'
export type AlertTone = 'info' | 'warning' | 'danger' | 'success'

export type StockMovementType =
  | 'stock_in'
  | 'sold'
  | 'died'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'personal_use'

export type ApiPeriod = {
  start: ApiDate
  end: ApiDate
  label: string
}

export type ApiUserRef = {
  profile_id: ApiId
  name: string
}

export type ApiFilterOption = {
  value: string
  label: string
}

export type DashboardSummaryParams = {
  date?: ApiDate
  period_start?: ApiDate
  period_end?: ApiDate
}

export type DashboardSummaryResponse = {
  as_of_date: ApiDate
  period: ApiPeriod
  kpis: DashboardKpis
  attention_items: DashboardAttentionItem[]
  growth: DashboardGrowth
  money_snapshot: DashboardMoneySnapshot
  pond_overview: DashboardPondOverview[]
}

export type DashboardKpis = {
  running_ponds: number
  feed_today_g: number
  feed_target_g: number
  feed_today_vs_target_pct: number
  feed_calculation_note: string
  survival_rate_pct: number
  mortality_this_week_pct: number
  mortality_this_week_count: number
}

export type DashboardAttentionItem = {
  id: string
  tone: AlertTone
  pond_id?: ApiId | null
  pond_name?: string | null
  cycle_id?: ApiId | null
  title: string
  description: string
  action_label?: string | null
}

export type DashboardGrowth = {
  scope: 'overall_running_ponds' | string
  title: string
  subtitle: string
  points: DashboardGrowthPoint[]
}

export type DashboardGrowthPoint = {
  date: ApiDate
  avg_weight_g: number
}

export type DashboardMoneySnapshot = {
  sales_this_month_rp: number
  expense_this_month_rp: number
  net_this_month_rp: number
}

export type DashboardPondOverview = {
  pond_id: ApiId
  pond_name: string
  cycle_id?: ApiId | null
  fish_species?: string | null
  days_since_stocking?: number | null
  live_fish_count: number
  survival_rate_pct?: number | null
  avg_weight_g?: number | null
  status: 'healthy' | 'warning' | 'danger' | string
}

export type PondsListParams = {
  include_inactive?: boolean
  q?: string
}

export type PondsListResponse = {
  summary: PondsListSummary
  ponds: PondListItem[]
}

export type PondsListSummary = {
  total_ponds: number
  active_ponds: number
  empty_ponds: number
}

export type PondListItem = {
  pond_id: ApiId
  pond_name: string
  pond_type?: string | null
  capacity_fish?: number | null
  status: PondStatus
  description?: string | null
  current_cycle?: PondListCurrentCycle | null
}

export type PondListCurrentCycle = {
  cycle_id: ApiId
  cycle_name: string
  fish_species: string
  date_start: ApiDate
  days_since_stocking: number
}

export type PondDetailParams = {
  pond_id: ApiId
  logs_limit?: number
  stock_limit?: number
}

export type PondDetailResponse = {
  pond: PondDetail
  current_cycle?: PondDetailCurrentCycle | null
  daily_logs: PondDailyLog[]
  stock_movements: PondStockMovement[]
  cycle_history: PondCycleHistory[]
}

export type PondDetail = {
  pond_id: ApiId
  pond_name: string
  pond_type?: string | null
  capacity_fish?: number | null
  status: PondStatus
  description?: string | null
}

export type PondDetailCurrentCycle = {
  cycle_id: ApiId
  cycle_name: string
  status: CycleStatus
  fish_species: string
  date_start: ApiDate
  days_since_stocking: number
  initial_stock_count: number
  live_fish_count: number
  survival_rate_pct?: number | null
  avg_weight_g?: number | null
  target_weight_g?: number | null
  target_progress_pct?: number | null
  harvest_prediction?: {
    days_left: number | null
    label: string
  } | null
  last_log?: {
    log_id: ApiId
    logged_at?: ApiDateTime | null
    date: ApiDate
    relative_label: string
  } | null
}

export type PondDailyLog = {
  log_id: ApiId
  date: ApiDate
  logged_at?: ApiDateTime | null
  feed_g: number
  sample_weight_g?: number | null
  sample_count?: number | null
  event?: string | null
  action?: string | null
  description?: string | null
  created_by?: ApiUserRef | null
  can_update: boolean
  can_delete: boolean
}

export type PondStockMovement = {
  movement_id: ApiId
  date: ApiDate
  movement_type: StockMovementType
  movement_label: string
  count: number
  weight_kg?: number | null
  description?: string | null
  created_at?: ApiDateTime | null
  can_delete: boolean
}

export type PondCycleHistory = {
  cycle_id: ApiId
  cycle_name: string
  fish_species: string
  date_start: ApiDate
  date_end?: ApiDate | null
  initial_stock_count: number
  status: CycleStatus
}

export type StockMovementsParams = {
  period?: 'today' | '7d' | '30d' | 'month' | '3m' | 'all'
  start_date?: ApiDate
  end_date?: ApiDate
  pond_id?: ApiId | 'all'
  type?: 'all' | 'in' | 'sold' | 'died' | 'transfer'
  limit?: number
  cursor?: string
}

export type StockMovementsResponse = {
  period: ApiPeriod
  pond_cards: StockPondCard[]
  filters: StockMovementFilters
  items: StockMovementListItem[]
  next_cursor?: string | null
}

export type StockPondCard = {
  pond_id: ApiId
  pond_name: string
  status: PondStatus
  fish_species?: string | null
  current_stock_count: number
  biomass_kg?: number | null
  avg_weight_g?: number | null
}

export type StockMovementFilters = {
  ponds: Array<{
    pond_id: ApiId | 'all'
    pond_name: string
  }>
  types: ApiFilterOption[]
}

export type StockMovementListItem = {
  movement_id: ApiId
  date: ApiDate
  pond_id: ApiId
  pond_name: string
  cycle_id?: ApiId | null
  cycle_name?: string | null
  fish_species?: string | null
  movement_type: StockMovementType
  movement_label: string
  direction: 'in' | 'out'
  count: number
  weight_kg?: number | null
  description?: string | null
  created_at?: ApiDateTime | null
  can_delete: boolean
}

export type CashSummaryParams = {
  month: string
}

export type CashSummaryResponse = {
  month: string
  period: ApiPeriod & {
    is_current_month: boolean
  }
  summary: CashSummary
  balance_points: CashBalancePoint[]
}

export type CashSummary = {
  opening_balance_rp: number
  ending_balance_rp: number
  income_rp: number
  outcome_rp: number
  net_rp: number
}

export type CashBalancePoint = {
  date: ApiDate
  balance_rp: number
  income_rp: number
  outcome_rp: number
  net_rp: number
}

export type CashTransactionsParams = {
  month: string
  type?: CashType
  category_id?: ApiId
  limit?: number
  cursor?: string
}

export type CashTransactionsResponse = {
  month: string
  items: CashTransactionItem[]
  next_cursor?: string | null
}

export type CashTransactionItem = {
  transaction_id: ApiId
  date: ApiDate
  type: CashType
  category_id?: ApiId | null
  category_name?: string | null
  description?: string | null
  amount_rp: number
  cycle_id?: ApiId | null
  source_sale_id?: ApiId | null
  created_by?: ApiUserRef | null
  can_delete: boolean
}

export type CashCategoriesParams = {
  type?: CashType
}

export type CashCategoriesResponse = {
  items: CashCategoryItem[]
}

export type CashCategoryItem = {
  category_id: ApiId
  type: CashType
  name: string
  sort_order: number
}

export type FormOptionsResponse = {
  active_ponds: Array<{
    pond_id: ApiId
    pond_name: string
    cycle_id: ApiId
    cycle_name: string
    fish_type_id: ApiId
    fish_species: string
  }>
  all_ponds: Array<{
    pond_id: ApiId
    pond_name: string
    status: PondStatus
  }>
  fish_types: Array<{
    fish_type_id: ApiId
    name: string
  }>
  cash_categories: CashCategoryItem[]
}
