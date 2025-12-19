/**
 * Redux Storage Middleware
 *
 * Redux state を LocalStorage に同期するカスタムミドルウェア
 * jotai/zustandのパターンを参考にSSR-safeで堅牢な実装
 */

import type {
  Middleware,
  MiddlewareAPI,
  Dispatch,
  AnyAction,
} from '@reduxjs/toolkit'

import { defaultJsonSerializer } from './serializers/json'
import { createSafeLocalStorage } from './storage'
import type {
  StorageMiddlewareConfig,
  StorageMiddlewareResult,
  HydrationApi,
  HydrationState,
  PersistedState,
  SyncStorage,
  Serializer,
  LegacyStorageMiddlewareConfig,
} from './types'
import { debounce } from './utils/debounce'
import { isServer, isStorageAvailable } from './utils/isServer'
import { throttle, scheduleIdleCallback } from './utils/throttle'

// =============================================================================
// Constants
// =============================================================================

const ACTION_HYDRATE_START = '@@redux-storage-middleware/HYDRATE_START'
const ACTION_HYDRATE_COMPLETE = '@@redux-storage-middleware/HYDRATE_COMPLETE'
const ACTION_HYDRATE_ERROR = '@@redux-storage-middleware/HYDRATE_ERROR'

const DEFAULT_DEBOUNCE_MS = 300
const DEFAULT_VERSION = 0

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * オブジェクトから指定されたパスの値を取得
 * (将来の機能拡張用に保持)
 */
function _getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current
}

/**
 * オブジェクトから指定されたパスを除外
 */
function excludePaths<T extends object>(obj: T, paths: string[]): Partial<T> {
  if (paths.length === 0) {
    return obj
  }

  const result = JSON.parse(JSON.stringify(obj)) as T

  for (const path of paths) {
    const keys = path.split('.')
    let current: Record<string, unknown> = result as Record<string, unknown>

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (current[key] === null || current[key] === undefined) {
        break
      }
      current = current[key] as Record<string, unknown>
    }

    const lastKey = keys[keys.length - 1]
    if (current && lastKey in current) {
      delete current[lastKey]
    }
  }

  return result
}

/**
 * 浅いマージ（デフォルト）
 */
function shallowMerge<T extends object>(
  persistedState: Partial<T>,
  currentState: T,
): T {
  return { ...currentState, ...persistedState }
}

/**
 * 深いマージ
 */
function deepMerge<T extends object>(
  persistedState: Partial<T>,
  currentState: T,
): T {
  const result = { ...currentState } as Record<string, unknown>

  for (const key in persistedState) {
    if (Object.prototype.hasOwnProperty.call(persistedState, key)) {
      const persistedValue = persistedState[key]
      const currentValue = result[key]

      if (
        typeof persistedValue === 'object' &&
        persistedValue !== null &&
        typeof currentValue === 'object' &&
        currentValue !== null &&
        !Array.isArray(persistedValue)
      ) {
        result[key] = deepMerge(
          persistedValue as Record<string, unknown>,
          currentValue as Record<string, unknown>,
        )
      } else {
        result[key] = persistedValue
      }
    }
  }

  return result as T
}

// =============================================================================
// Storage Middleware Factory
// =============================================================================

/**
 * Storage Middleware を作成
 *
 * @param config - ミドルウェア設定
 * @returns ミドルウェアとハイドレーションAPI
 *
 * @example
 * ```ts
 * const { middleware, api } = createStorageMiddleware({
 *   name: 'my-app-state',
 *   slices: ['settings', 'preferences'],
 *   skipHydration: false,
 *   version: 1,
 *   migrate: (state, version) => {
 *     if (version === 0) {
 *       return { ...state, newField: 'default' }
 *     }
 *     return state
 *   },
 * })
 *
 * const store = configureStore({
 *   reducer: rootReducer,
 *   middleware: (getDefaultMiddleware) =>
 *     getDefaultMiddleware().concat(middleware),
 * })
 *
 * // SSR時は手動でハイドレーション
 * if (typeof window !== 'undefined') {
 *   api.rehydrate()
 * }
 * ```
 */
export function createStorageMiddleware<
  S extends object = Record<string, unknown>,
>(config: StorageMiddlewareConfig<S>): StorageMiddlewareResult<S> {
  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const {
    name,
    slices,
    partialize,
    exclude = [],
    skipHydration = false,
    version = DEFAULT_VERSION,
    migrate,
    storage: customStorage,
    serializer = defaultJsonSerializer as Serializer<
      PersistedState<Partial<S>>
    >,
    performance: perfConfig,
    debounceMs: legacyDebounceMs,
    onHydrate,
    onHydrationComplete,
    onSaveComplete,
    onError,
    merge = shallowMerge,
  } = config

  // パフォーマンス設定の解決
  const debounceMs =
    perfConfig?.debounceMs ?? legacyDebounceMs ?? DEFAULT_DEBOUNCE_MS
  const throttleMs = perfConfig?.throttleMs
  const useIdleCallback = perfConfig?.useIdleCallback ?? false
  const idleTimeout = perfConfig?.idleTimeout ?? 1000

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let hydrationState: HydrationState = 'idle'
  let hydratedState: S | null = null
  let storeApi: MiddlewareAPI<Dispatch<AnyAction>, S> | null = null

  const hydrateCallbacks = new Set<(state: S) => void>()
  const finishHydrationCallbacks = new Set<(state: S) => void>()

  // ---------------------------------------------------------------------------
  // Storage Setup
  // ---------------------------------------------------------------------------

  // SSR-safeなストレージを取得
  const getStorage = (): SyncStorage => {
    if (customStorage) {
      // 非同期ストレージの場合は同期ラッパーを返す
      // 注意: 実際の非同期処理は別途ハンドリングが必要
      return customStorage as SyncStorage
    }
    return createSafeLocalStorage()
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /**
   * 保存する状態を抽出
   */
  const extractStateToSave = (state: S): Partial<S> => {
    let stateToSave: Partial<S>

    if (partialize) {
      // partialize関数で選択
      stateToSave = partialize(state)
    } else if (slices && slices.length > 0) {
      // slices配列で選択
      stateToSave = {} as Partial<S>
      for (const sliceName of slices) {
        const value = (state as Record<string, unknown>)[sliceName]
        if (value !== undefined) {
          ;(stateToSave as Record<string, unknown>)[sliceName] = value
        }
      }
    } else {
      // 全体を保存
      stateToSave = state
    }

    // 除外パスを適用
    if (exclude.length > 0) {
      stateToSave = excludePaths(stateToSave as object, exclude) as Partial<S>
    }

    return stateToSave
  }

  /**
   * ストレージに保存
   */
  const saveToStorage = (state: S): void => {
    if (isServer()) {
      return
    }

    try {
      const storage = getStorage()
      const stateToSave = extractStateToSave(state)

      const persistedState: PersistedState<Partial<S>> = {
        version,
        state: stateToSave,
      }

      const serialized = serializer.serialize(persistedState)
      storage.setItem(name, serialized)

      onSaveComplete?.(state)
    } catch (error) {
      console.error('[redux-storage-middleware] Failed to save state:', error)
      onError?.(error as Error, 'save')
    }
  }

  /**
   * ストレージから読み込み
   */
  const loadFromStorage = (): PersistedState<Partial<S>> | null => {
    if (isServer()) {
      return null
    }

    try {
      const storage = getStorage()
      const serialized = storage.getItem(name)

      if (serialized === null) {
        return null
      }

      return serializer.deserialize(serialized)
    } catch (error) {
      console.error('[redux-storage-middleware] Failed to load state:', error)
      onError?.(error as Error, 'load')
      return null
    }
  }

  // ---------------------------------------------------------------------------
  // Debounce/Throttle Setup
  // ---------------------------------------------------------------------------

  // cancelSaveは将来のAPI拡張用に保持（現在は未使用）
  let _cancelSave: (() => void) | null = null
  let saveHandler: ((state: S) => void) | null = null

  const setupSaveHandler = (): void => {
    if (useIdleCallback) {
      const { scheduledFn, cancel } = scheduleIdleCallback(saveToStorage, {
        timeout: idleTimeout,
      })
      saveHandler = scheduledFn as (state: S) => void
      _cancelSave = cancel
    } else if (throttleMs) {
      const { throttledFn, cancel } = throttle(saveToStorage, throttleMs)
      saveHandler = throttledFn as (state: S) => void
      _cancelSave = cancel
    } else {
      const { debouncedFn, cancel } = debounce(saveToStorage, debounceMs)
      saveHandler = debouncedFn as (state: S) => void
      _cancelSave = cancel
    }
  }

  setupSaveHandler()

  // ---------------------------------------------------------------------------
  // Hydration API
  // ---------------------------------------------------------------------------

  const api: HydrationApi<S> = {
    rehydrate: async (): Promise<void> => {
      if (hydrationState === 'hydrating') {
        return
      }

      hydrationState = 'hydrating'
      onHydrate?.()

      // コールバック通知
      for (const callback of hydrateCallbacks) {
        callback(storeApi?.getState() as S)
      }

      try {
        const persisted = loadFromStorage()

        if (persisted === null) {
          hydrationState = 'hydrated'
          hydratedState = null
          return
        }

        let state = persisted.state as S

        // マイグレーション
        if (migrate && persisted.version !== version) {
          state = (await migrate(state, persisted.version)) as S
        }

        // 現在の状態とマージ
        if (storeApi) {
          const currentState = storeApi.getState()
          hydratedState = merge(state as Partial<S>, currentState)

          // ストアを更新（ハイドレーションアクションをディスパッチ）
          storeApi.dispatch({
            type: ACTION_HYDRATE_COMPLETE,
            payload: hydratedState,
          } as AnyAction)
        } else {
          hydratedState = state
        }

        // eslint-disable-next-line require-atomic-updates -- シングルスレッド環境で安全に動作
        hydrationState = 'hydrated'
        onHydrationComplete?.(hydratedState)

        // 完了コールバック通知
        for (const callback of finishHydrationCallbacks) {
          callback(hydratedState)
        }
      } catch (error) {
        console.error('[redux-storage-middleware] Hydration failed:', error)
        // eslint-disable-next-line require-atomic-updates -- シングルスレッド環境で安全に動作
        hydrationState = 'error'
        onError?.(error as Error, 'load')
      }
    },

    hasHydrated: (): boolean => {
      return hydrationState === 'hydrated'
    },

    getHydrationState: (): HydrationState => {
      return hydrationState
    },

    getHydratedState: (): S | null => {
      return hydratedState
    },

    clearStorage: (): void => {
      if (isServer()) {
        return
      }

      try {
        const storage = getStorage()
        storage.removeItem(name)
      } catch (error) {
        console.error(
          '[redux-storage-middleware] Failed to clear storage:',
          error,
        )
        onError?.(error as Error, 'clear')
      }
    },

    onHydrate: (callback: (state: S) => void): (() => void) => {
      hydrateCallbacks.add(callback)
      return () => {
        hydrateCallbacks.delete(callback)
      }
    },

    onFinishHydration: (callback: (state: S) => void): (() => void) => {
      finishHydrationCallbacks.add(callback)

      // 既にハイドレーション完了済みの場合は即座にコールバック
      if (hydrationState === 'hydrated' && hydratedState) {
        callback(hydratedState)
      }

      return () => {
        finishHydrationCallbacks.delete(callback)
      }
    },
  }

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------

  const middleware: Middleware<object, S> = (store) => {
    storeApi = store as MiddlewareAPI<Dispatch<AnyAction>, S>

    // 自動ハイドレーション
    if (!skipHydration && !isServer()) {
      // マイクロタスクで実行（ストア初期化後）
      Promise.resolve().then(() => {
        api.rehydrate()
      })
    }

    return (next) => (action) => {
      const result = next(action)

      // ハイドレーションアクションの処理
      if (
        typeof action === 'object' &&
        action !== null &&
        'type' in action &&
        typeof action.type === 'string'
      ) {
        // HYDRATE_COMPLETEアクションで内部状態を更新
        if (action.type === ACTION_HYDRATE_COMPLETE) {
          hydrationState = 'hydrated'
          hydratedState = (action as unknown as { payload: S }).payload
          return result
        }

        // その他のミドルウェアアクションは保存しない
        if (action.type.startsWith('@@redux-storage-middleware/')) {
          return result
        }
      }

      // ハイドレーション完了後のみ保存
      if (hydrationState === 'hydrated' && saveHandler) {
        saveHandler(store.getState())
      }

      return result
    }
  }

  return { middleware, api }
}

// =============================================================================
// Legacy API (Backward Compatibility)
// =============================================================================

/**
 * 旧APIとの互換性のためのラッパー
 *
 * @deprecated createStorageMiddleware を使用してください
 */
export function createLegacyStorageMiddleware(
  config: LegacyStorageMiddlewareConfig,
): Middleware {
  const { middleware } = createStorageMiddleware({
    name: config.storageKey,
    slices: config.slices,
    performance: {
      debounceMs: config.debounceMs,
    },
  })

  return middleware
}

// =============================================================================
// Standalone Functions
// =============================================================================

/**
 * LocalStorage から初期状態を復元
 *
 * @param storageKey - LocalStorage のキー
 * @param serializer - シリアライザー
 * @returns 復元された state または null
 *
 * @example
 * ```ts
 * const preloadedState = loadStateFromStorage('my-app-state')
 * const store = configureStore({
 *   reducer: rootReducer,
 *   preloadedState: preloadedState?.state,
 * })
 * ```
 */
export function loadStateFromStorage<S = unknown>(
  storageKey: string,
  serializer: Serializer<
    PersistedState<S>
  > = defaultJsonSerializer as Serializer<PersistedState<S>>,
): PersistedState<S> | null {
  if (isServer() || !isStorageAvailable()) {
    return null
  }

  try {
    const storage = createSafeLocalStorage()
    const serialized = storage.getItem(storageKey)

    if (serialized === null) {
      return null
    }

    return serializer.deserialize(serialized)
  } catch (error) {
    console.error('[redux-storage-middleware] Failed to load state:', error)
    return null
  }
}

/**
 * LocalStorage から state を削除
 *
 * @param storageKey - LocalStorage のキー
 */
export function clearStorageState(storageKey: string): void {
  if (isServer() || !isStorageAvailable()) {
    return
  }

  try {
    const storage = createSafeLocalStorage()
    storage.removeItem(storageKey)
  } catch (error) {
    console.error('[redux-storage-middleware] Failed to clear state:', error)
  }
}

/**
 * ハイドレーション用のreducerエンハンサー
 *
 * ハイドレーションアクションを処理するためにreducerをラップ
 *
 * @param reducer - 元のreducer
 * @returns ハイドレーション対応reducer
 *
 * @example
 * ```ts
 * const store = configureStore({
 *   reducer: withHydration(rootReducer),
 *   middleware: (getDefaultMiddleware) =>
 *     getDefaultMiddleware().concat(middleware),
 * })
 * ```
 */
export function withHydration<S>(
  reducer: (state: S | undefined, action: AnyAction) => S,
): (state: S | undefined, action: AnyAction) => S {
  return (state, action) => {
    if (action.type === ACTION_HYDRATE_COMPLETE) {
      // ハイドレーション完了: 状態を上書き
      return action.payload as S
    }

    return reducer(state, action)
  }
}

// =============================================================================
// Exports
// =============================================================================

export {
  ACTION_HYDRATE_START,
  ACTION_HYDRATE_COMPLETE,
  ACTION_HYDRATE_ERROR,
  shallowMerge,
  deepMerge,
}
