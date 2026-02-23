/**
 * useKV — localStorage-backed drop-in replacement for @github/spark/hooks useKV.
 * Works in any standalone Vite/React app without a Spark runtime.
 *
 * API matches the Spark useKV exactly:
 *   const [value, setValue, deleteValue] = useKV<T>(key, initialValue)
 *
 * setValue supports both direct values and functional updaters: setValue(v => v + 1)
 */
import { useState, useCallback } from 'react'

const PREFIX = 'okv:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch { /* ignore quota errors */ }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch { /* ignore */ }
}

export function useKV<T>(
  key: string,
  initialValue: T
): [T, (valOrUpdater: T | ((prev: T) => T)) => void, () => void] {
  const [state, setStateRaw] = useState<T>(() => read(key, initialValue))

  const setState = useCallback(
    (valOrUpdater: T | ((prev: T) => T)) => {
      setStateRaw(prev => {
        const next = typeof valOrUpdater === 'function'
          ? (valOrUpdater as (prev: T) => T)(prev)
          : valOrUpdater
        write(key, next)
        return next
      })
    },
    [key]
  )

  const deleteValue = useCallback(() => {
    remove(key)
    setStateRaw(initialValue)
  }, [key, initialValue])

  return [state, setState, deleteValue]
}
