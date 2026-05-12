import { isSupabaseConfigured, supabase } from '../supabase'

type RpcParams = Record<string, unknown>

export class ReadApiError extends Error {
  details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'ReadApiError'
    this.details = details
  }
}

export class MutationApiError extends Error {
  details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'MutationApiError'
    this.details = details
  }
}

export async function callReadRpc<TResponse>(
  functionName: string,
  params: RpcParams = {},
): Promise<TResponse> {
  if (!isSupabaseConfigured || !supabase) {
    throw new ReadApiError(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }

  const { data, error } = await supabase.rpc(functionName, params)

  if (error) {
    throw new ReadApiError(error.message, error)
  }

  return data as TResponse
}

export async function callMutationRpc<TResponse>(
  functionName: string,
  params: RpcParams = {},
): Promise<TResponse> {
  if (!isSupabaseConfigured || !supabase) {
    throw new MutationApiError(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }

  const { data, error } = await supabase.rpc(functionName, params)

  if (error) {
    throw new MutationApiError(error.message, error)
  }

  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok?: unknown }).ok === false
  ) {
    throw new MutationApiError(
      typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : `${functionName} failed`,
      data,
    )
  }

  return data as TResponse
}
