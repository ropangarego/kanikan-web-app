import { useEffect, useState } from 'react'

export const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const saveToStorage = <T,>(key: string, value: T) => {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export const usePersistentState = <T,>(key: string, fallback: T) => {
  const [value, setValue] = useState<T>(() => loadFromStorage(key, fallback))

  useEffect(() => {
    saveToStorage(key, value)
  }, [key, value])

  return [value, setValue] as const
}
