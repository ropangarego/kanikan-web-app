import type {
  DashboardSummaryParams,
  DashboardSummaryResponse,
} from '../../types/api-contract'
import { callReadRpc } from './client'

export function getDashboardSummary(params: DashboardSummaryParams = {}) {
  return callReadRpc<DashboardSummaryResponse>('api_dashboard_summary', {
    p_date: params.date ?? null,
    p_period_start: params.period_start ?? null,
    p_period_end: params.period_end ?? null,
  })
}
