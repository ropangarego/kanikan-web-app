import type {
  PondDetailParams,
  PondDetailResponse,
  PondsListParams,
  PondsListResponse,
} from '../../types/api-contract'
import { callReadRpc } from './client'

export function getPondsList(params: PondsListParams = {}) {
  return callReadRpc<PondsListResponse>('api_ponds_list', {
    p_include_inactive: params.include_inactive ?? false,
    p_q: params.q ?? null,
  })
}

export function getPondDetail(params: PondDetailParams) {
  return callReadRpc<PondDetailResponse>('api_pond_detail', {
    p_pond_id: params.pond_id,
    p_logs_limit: params.logs_limit ?? 30,
    p_stock_limit: params.stock_limit ?? 30,
  })
}
