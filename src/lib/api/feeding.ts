import type {
  FeedingInputStatus,
  FeedingPageParams,
  FeedingPageResponse,
  FeedingSessionLabel,
} from '../../types/api-contract'
import { callMutationRpc, callReadRpc } from './client'

export type FeedingEntryInput = {
  unitId: string
  feedG: number | null
  inputStatus: FeedingInputStatus
}

export type FeedingSessionCreateInput = {
  date: string
  sessionLabel: FeedingSessionLabel
  note?: string
  entries: FeedingEntryInput[]
}

export type FeedingMutationResult = {
  ok: true
  item?: {
    session_id: string
  }
  refresh?: string[]
}

export function getFeedingPage(params: FeedingPageParams = {}) {
  return callReadRpc<FeedingPageResponse>('api_feeding_page', {
    p_date: params.date ?? null,
    p_session_label: params.session_label ?? 'morning',
  })
}

export function createFeedingSession(input: FeedingSessionCreateInput) {
  return callMutationRpc<FeedingMutationResult>('api_feeding_session_create', {
    p_date: input.date,
    p_session_label: input.sessionLabel,
    p_note: input.note ?? '',
    p_entries: input.entries.map((entry) => ({
      unit_id: entry.unitId,
      feed_g: entry.feedG,
      input_status: entry.inputStatus,
    })),
  })
}
