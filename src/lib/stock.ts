import type { Cycle, DailyLog, StockMovement, StockMovementType } from '../types/domain'

const incoming: StockMovementType[] = ['stock_in', 'transfer_in', 'adjustment_in']

export const getMovementDelta = (type: StockMovementType, count: number) =>
  incoming.includes(type) ? count : -count

export const calculateLiveStock = (movements: StockMovement[]) =>
  movements.reduce((total, movement) => total + getMovementDelta(movement.movementType, movement.count), 0)

export const getLatestSampleWeight = (cycleId: string, logs: DailyLog[]) =>
  logs
    .filter((log) => log.cycleId === cycleId && log.sampleWeightG !== null)
    .sort((left, right) => right.date.localeCompare(left.date))[0]?.sampleWeightG ?? null

export const getCycleMovementTotals = (cycleId: string, movements: StockMovement[]) => {
  const totals = {
    stockIn: 0,
    died: 0,
    sold: 0,
    transferOut: 0,
    transferIn: 0,
    personalUse: 0,
    adjustmentOut: 0,
    adjustmentIn: 0,
    alive: 0,
  }

  movements
    .filter((movement) => movement.cycleId === cycleId)
    .forEach((movement) => {
      switch (movement.movementType) {
        case 'stock_in':
          totals.stockIn += movement.count
          break
        case 'died':
          totals.died += movement.count
          break
        case 'sold':
          totals.sold += movement.count
          break
        case 'transfer_out':
          totals.transferOut += movement.count
          break
        case 'transfer_in':
          totals.transferIn += movement.count
          break
        case 'personal_use':
          totals.personalUse += movement.count
          break
        case 'adjustment_out':
          totals.adjustmentOut += movement.count
          break
        case 'adjustment_in':
          totals.adjustmentIn += movement.count
          break
      }
    })

  totals.alive =
    totals.stockIn +
    totals.transferIn +
    totals.adjustmentIn -
    totals.died -
    totals.sold -
    totals.transferOut -
    totals.personalUse -
    totals.adjustmentOut

  return totals
}

export const getPredictionState = (
  cycle: Cycle,
  logs: DailyLog[],
  growthRateDefault: number,
) => {
  if (!cycle.targetWeightG) {
    return { status: 'Target belum diisi', daysToTarget: null, confidence: 'low' as const }
  }

  const latestWeight = getLatestSampleWeight(cycle.id, logs) ?? cycle.avgSeedWeightG
  const growthRate = getLatestSampleWeight(cycle.id, logs) ? 2.1 : growthRateDefault
  const remaining = Math.max(cycle.targetWeightG - latestWeight, 0)

  return {
    status: remaining === 0 ? 'Siap panen' : 'Menuju target',
    daysToTarget: remaining === 0 ? 0 : Math.ceil(remaining / growthRate),
    confidence: getLatestSampleWeight(cycle.id, logs) ? ('medium' as const) : ('low' as const),
  }
}
