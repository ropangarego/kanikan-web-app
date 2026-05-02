import type {
  CashCategoriesParams,
  CashCategoriesResponse,
  CashSummaryParams,
  CashSummaryResponse,
  CashTransactionsParams,
  CashTransactionsResponse,
} from '../../types/api-contract'
import { callReadRpc } from './client'

export function getCashSummary(params: CashSummaryParams) {
  return callReadRpc<CashSummaryResponse>('api_cash_summary', {
    p_month: params.month,
  })
}

export function getCashTransactions(params: CashTransactionsParams) {
  return callReadRpc<CashTransactionsResponse>('api_cash_transactions', {
    p_month: params.month,
    p_type: params.type ?? null,
    p_category_id: params.category_id ?? null,
    p_limit: params.limit ?? 50,
    p_cursor: params.cursor ?? null,
  })
}

export function getCashCategories(params: CashCategoriesParams = {}) {
  return callReadRpc<CashCategoriesResponse>('api_cash_categories', {
    p_type: params.type ?? null,
  })
}
