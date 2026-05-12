import type { CashType, StockMovementType } from '../../types/domain'
import { isSupabaseConfigured, supabase } from '../supabase'
import { callMutationRpc } from './client'

type MutationResult<TItem = unknown> = {
  ok: true
  item?: TItem
  refresh?: string[]
}

export type DailyLogCreateInput = {
  date: string
  unitId: string
  feedG: number
  event?: string
  action?: string
  description?: string
  sampleWeightG?: number | null
  sampleCount?: number | null
}

export type StockMovementCreateInput = {
  date: string
  unitId: string
  movementType: StockMovementType
  count: number
  weightKg?: number | null
  description?: string
  toUnitId?: string | null
}

export type CashTransactionInput = {
  date: string
  type: CashType
  categoryId: string
  amountRp: number
  description?: string | null
  cycleId?: string | null
}

export type CycleStartInput = {
  unitId: string
  fishTypeId: string
  dateStart: string
  initialStock: number
  avgSeedWeightG?: number | null
  targetWeightG?: number | null
  capitalRp?: number
  description?: string
}

export type PondCreateInput = {
  name: string
  type?: string | null
  capacity?: number | null
  isActive?: boolean
  description?: string | null
}

export function createPond(input: PondCreateInput) {
  return callMutationRpc<MutationResult<{ pond_id: string }>>('api_pond_create', {
    p_name: input.name,
    p_type: input.type ?? null,
    p_capacity: input.capacity ?? null,
    p_is_active: input.isActive ?? false,
    p_description: input.description ?? '',
  })
}

export function updatePond(pondId: string, input: PondCreateInput) {
  return callMutationRpc<MutationResult<{ pond_id: string }>>('api_pond_update', {
    p_unit_id: pondId,
    p_name: input.name,
    p_type: input.type ?? null,
    p_capacity: input.capacity ?? null,
    p_is_active: input.isActive ?? false,
    p_description: input.description ?? '',
  })
}

export function archivePond(pondId: string) {
  return callMutationRpc<MutationResult<{ pond_id: string }>>('api_pond_archive', {
    p_unit_id: pondId,
  })
}

export function createDailyLog(input: DailyLogCreateInput) {
  return callMutationRpc<MutationResult>('api_daily_log_create', {
    p_date: input.date,
    p_unit_id: input.unitId,
    p_feed_g: input.feedG,
    p_event: input.event ?? '',
    p_action: input.action ?? '',
    p_description: input.description ?? '',
    p_sample_weight_g: input.sampleWeightG ?? null,
    p_sample_count: input.sampleCount ?? null,
  })
}

export function deleteDailyLog(logId: string) {
  return callMutationRpc<MutationResult>('api_daily_log_delete', {
    p_log_id: logId,
  })
}

export function updateDailyLog(logId: string, input: Omit<DailyLogCreateInput, 'unitId'>) {
  return callMutationRpc<MutationResult>('api_daily_log_update', {
    p_log_id: logId,
    p_date: input.date,
    p_feed_g: input.feedG,
    p_event: input.event ?? '',
    p_action: input.action ?? '',
    p_description: input.description ?? '',
    p_sample_weight_g: input.sampleWeightG ?? null,
    p_sample_count: input.sampleCount ?? null,
  })
}

export function createStockMovement(input: StockMovementCreateInput) {
  return callMutationRpc<MutationResult<{ movement_id: string }>>('api_stock_movement_create', {
    p_date: input.date,
    p_unit_id: input.unitId,
    p_movement_type: input.movementType,
    p_count: input.count,
    p_weight_kg: input.weightKg ?? null,
    p_description: input.description ?? '',
    p_to_unit_id: input.toUnitId ?? null,
  })
}

export function deleteStockMovement(movementId: string) {
  return callMutationRpc<MutationResult>('api_stock_movement_delete', {
    p_movement_id: movementId,
  })
}

export function createCashTransaction(input: CashTransactionInput) {
  return callMutationRpc<MutationResult<{ transaction_id: string }>>('api_cash_transaction_create', {
    p_date: input.date,
    p_type: input.type,
    p_category_id: input.categoryId,
    p_amount_rp: input.amountRp,
    p_description: input.description ?? '',
    p_cycle_id: input.cycleId ?? null,
  })
}

export function updateCashTransaction(transactionId: string, input: CashTransactionInput) {
  return callMutationRpc<MutationResult>('api_cash_transaction_update', {
    p_transaction_id: transactionId,
    p_date: input.date,
    p_type: input.type,
    p_category_id: input.categoryId,
    p_amount_rp: input.amountRp,
    p_description: input.description ?? '',
    p_cycle_id: input.cycleId ?? null,
  })
}

export function deleteCashTransaction(transactionId: string) {
  return callMutationRpc<MutationResult>('api_cash_transaction_delete', {
    p_transaction_id: transactionId,
  })
}

export async function updateProfile(input: { language: 'id' | 'en'; telegramId: string }) {
  try {
    return await callMutationRpc<MutationResult>('api_profile_update', {
      p_language: input.language,
      p_telegram_id: input.telegramId,
    })
  } catch (rpcError) {
    if (!isSupabaseConfigured || !supabase) throw rpcError

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw rpcError

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        language: input.language,
        telegram_id: input.telegramId.trim() ? input.telegramId.trim() : null,
      })
      .eq('id', userData.user.id)

    if (updateError) throw rpcError
    return { ok: true, refresh: ['profile_me'] }
  }
}

export function startCycle(input: CycleStartInput) {
  return callMutationRpc<MutationResult>('api_cycle_start', {
    p_unit_id: input.unitId,
    p_fish_type_id: input.fishTypeId,
    p_date_start: input.dateStart,
    p_initial_stock: input.initialStock,
    p_avg_seed_weight_g: input.avgSeedWeightG ?? null,
    p_target_weight_g: input.targetWeightG ?? null,
    p_capital_rp: input.capitalRp ?? 0,
    p_description: input.description ?? '',
  })
}

export function closeCycle(input: { cycleId: string; dateEnd: string; reason: string }) {
  return callMutationRpc<MutationResult>('api_cycle_close', {
    p_cycle_id: input.cycleId,
    p_date_end: input.dateEnd,
    p_reason: input.reason,
  })
}

export function transferCycle(input: { cycleId: string; toUnitId: string; date: string; reason: string }) {
  return callMutationRpc<MutationResult>('api_cycle_transfer', {
    p_cycle_id: input.cycleId,
    p_to_unit_id: input.toUnitId,
    p_date: input.date,
    p_reason: input.reason,
  })
}
