import type { FormOptionsResponse } from '../../types/api-contract'
import { callReadRpc } from './client'

export function getFormOptions() {
  return callReadRpc<FormOptionsResponse>('api_form_options')
}
