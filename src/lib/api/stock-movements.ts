import type {
  StockMovementsParams,
  StockMovementsResponse,
} from '../../types/api-contract'
import { callReadRpc } from './client'

export function getStockMovements(params: StockMovementsParams = {}) {
  return callReadRpc<StockMovementsResponse>('api_stock_movements', {
    p_period: params.period ?? '30d',
    p_start_date: params.start_date ?? null,
    p_end_date: params.end_date ?? null,
    p_pond_id: params.pond_id ?? 'all',
    p_type: params.type ?? 'all',
    p_limit: params.limit ?? 50,
    p_cursor: params.cursor ?? null,
  })
}
