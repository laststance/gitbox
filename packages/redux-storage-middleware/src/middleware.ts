/**
 * Redux Storage Middleware
 *
 * Redux state を LocalStorage に同期するカスタムミドルウェア
 * redux-persist の代替として、シンプルで軽量な実装
 */

import type { Middleware } from '@reduxjs/toolkit'

import type { StorageMiddlewareConfig } from './types'

/**
 * LocalStorage に state を保存
 */
function saveToStorage(key: string, state: unknown): void {
  try {
    const serialized = JSON.stringify(state)
    localStorage.setItem(key, serialized)
  } catch (error) {
    console.error('Failed to save state to localStorage:', error)
  }
}

/**
 * LocalStorage から state を読み込み
 */
function loadFromStorage(key: string): unknown {
  try {
    const serialized = localStorage.getItem(key)
    if (serialized === null) {
      return null
    }
    return JSON.parse(serialized) as unknown
  } catch (error) {
    console.error('Failed to load state from localStorage:', error)
    return null
  }
}

/**
 * Storage Middleware を作成
 *
 * @param config - ミドルウェア設定
 * @returns Redux middleware
 *
 * @example
 * ```ts
 * const storageMiddleware = createStorageMiddleware({
 *   slices: ['settings', 'preferences'],
 *   storageKey: 'my-app-state',
 *   debounceMs: 500,
 * })
 * ```
 */
export function createStorageMiddleware(
  config: StorageMiddlewareConfig,
): Middleware {
  const { slices, storageKey, debounceMs = 300 } = config

  let timeoutId: NodeJS.Timeout | null = null

  return (store) => (next) => (action) => {
    const result = next(action)

    // デバウンス処理
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      const state = store.getState()

      // 指定されたスライスのみを保存
      const stateToSave: Record<string, unknown> = {}
      slices.forEach((sliceName) => {
        if (state[sliceName]) {
          stateToSave[sliceName] = state[sliceName]
        }
      })

      saveToStorage(storageKey, stateToSave)
    }, debounceMs)

    return result
  }
}

/**
 * LocalStorage から初期状態を復元
 *
 * @param storageKey - LocalStorage のキー
 * @returns 復元された state または null
 *
 * @example
 * ```ts
 * const preloadedState = loadStateFromStorage('my-app-state')
 * const store = configureStore({
 *   reducer: rootReducer,
 *   preloadedState,
 * })
 * ```
 */
export function loadStateFromStorage(storageKey: string): unknown {
  return loadFromStorage(storageKey)
}

/**
 * LocalStorage から state を削除
 *
 * @param storageKey - LocalStorage のキー
 */
export function clearStorageState(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey)
  } catch (error) {
    console.error('Failed to clear state from localStorage:', error)
  }
}
