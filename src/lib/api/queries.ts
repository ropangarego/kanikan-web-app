import { useQuery } from '@tanstack/react-query'
import { isSupabaseConfigured } from '../supabase'
import type {
  CashCategoriesParams,
  CashSummaryParams,
  CashTransactionsParams,
  DashboardSummaryParams,
  PondDetailParams,
  PondsListParams,
  StockMovementsParams,
} from '../../types/api-contract'
import { getCashCategories, getCashSummary, getCashTransactions } from './cash'
import { getDashboardSummary } from './dashboard'
import { getFormOptions } from './form-options'
import { getPondDetail, getPondsList } from './ponds'
import { getStockMovements } from './stock-movements'

export const readApiKeys = {
  dashboardSummary: (params: DashboardSummaryParams) => ['read-api', 'dashboard-summary', params] as const,
  pondsList: (params: PondsListParams) => ['read-api', 'ponds-list', params] as const,
  pondDetail: (params: PondDetailParams) => ['read-api', 'pond-detail', params] as const,
  stockMovements: (params: StockMovementsParams) => ['read-api', 'stock-movements', params] as const,
  cashSummary: (params: CashSummaryParams) => ['read-api', 'cash-summary', params] as const,
  cashTransactions: (params: CashTransactionsParams) => ['read-api', 'cash-transactions', params] as const,
  cashCategories: (params: CashCategoriesParams) => ['read-api', 'cash-categories', params] as const,
  formOptions: () => ['read-api', 'form-options'] as const,
}

const readQueryOptions = {
  enabled: isSupabaseConfigured,
  retry: false,
}

export function useDashboardSummaryQuery(params: DashboardSummaryParams = {}) {
  return useQuery({
    queryKey: readApiKeys.dashboardSummary(params),
    queryFn: () => getDashboardSummary(params),
    ...readQueryOptions,
  })
}

export function usePondsListQuery(params: PondsListParams = {}) {
  return useQuery({
    queryKey: readApiKeys.pondsList(params),
    queryFn: () => getPondsList(params),
    ...readQueryOptions,
  })
}

export function usePondDetailQuery(params: PondDetailParams) {
  return useQuery({
    queryKey: readApiKeys.pondDetail(params),
    queryFn: () => getPondDetail(params),
    enabled: isSupabaseConfigured && Boolean(params.pond_id),
    retry: false,
  })
}

export function useStockMovementsQuery(params: StockMovementsParams = {}) {
  return useQuery({
    queryKey: readApiKeys.stockMovements(params),
    queryFn: () => getStockMovements(params),
    ...readQueryOptions,
  })
}

export function useCashSummaryQuery(params: CashSummaryParams) {
  return useQuery({
    queryKey: readApiKeys.cashSummary(params),
    queryFn: () => getCashSummary(params),
    enabled: isSupabaseConfigured && Boolean(params.month),
    retry: false,
  })
}

export function useCashTransactionsQuery(params: CashTransactionsParams) {
  return useQuery({
    queryKey: readApiKeys.cashTransactions(params),
    queryFn: () => getCashTransactions(params),
    enabled: isSupabaseConfigured && Boolean(params.month),
    retry: false,
  })
}

export function useCashCategoriesQuery(params: CashCategoriesParams = {}) {
  return useQuery({
    queryKey: readApiKeys.cashCategories(params),
    queryFn: () => getCashCategories(params),
    ...readQueryOptions,
  })
}

export function useFormOptionsQuery() {
  return useQuery({
    queryKey: readApiKeys.formOptions(),
    queryFn: () => getFormOptions(),
    ...readQueryOptions,
  })
}
