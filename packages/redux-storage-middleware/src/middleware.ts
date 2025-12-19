/**
 * Redux Storage Middleware
 *
 * Custom middleware for synchronizing Redux state with LocalStorage
 * SSR-safe and robust implementation based on patterns from jotai/zustand
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

/**
 * Minimum and maximum length for storage key names
 */
const MIN_STORAGE_KEY_LENGTH = 1
const MAX_STORAGE_KEY_LENGTH = 255

/**
 * Valid storage key name pattern
 * Only alphanumeric characters, dots, underscores, and hyphens are allowed
 */
const VALID_STORAGE_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/

/**
 * Reserved key names prohibited for security reasons
 * Prevents prototype pollution attacks
 */
const RESERVED_STORAGE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates storage key name
 *
 * @param name - The key name to validate
 * @throws Error if the key name is invalid
 *
 * @example
 * ```ts
 * validateStorageKeyName('my-app-state')  // OK
 * validateStorageKeyName('app.settings')  // OK
 * validateStorageKeyName('')              // Error: empty key
 * validateStorageKeyName('__proto__')     // Error: reserved word
 * validateStorageKeyName('key with spaces') // Error: invalid characters
 * ```
 */
function validateStorageKeyName(name: string): void {
  // Length check
  if (name.length < MIN_STORAGE_KEY_LENGTH) {
    throw new Error(
      `[redux-storage-middleware] Storage key name must not be empty`,
    )
  }

  if (name.length > MAX_STORAGE_KEY_LENGTH) {
    throw new Error(
      `[redux-storage-middleware] Storage key name must not exceed ${MAX_STORAGE_KEY_LENGTH} characters`,
    )
  }

  // Pattern check
  if (!VALID_STORAGE_KEY_PATTERN.test(name)) {
    throw new Error(
      `[redux-storage-middleware] Storage key name "${name}" contains invalid characters. ` +
        `Only alphanumeric characters, dots, underscores, and hyphens are allowed.`,
    )
  }

  // Reserved word check
  if (RESERVED_STORAGE_KEYS.has(name)) {
    throw new Error(
      `[redux-storage-middleware] Storage key name "${name}" is reserved and cannot be used.`,
    )
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Excludes specified paths from an object
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
 * Shallow merge (default)
 */
function shallowMerge<T extends object>(
  persistedState: Partial<T>,
  currentState: T,
): T {
  return { ...currentState, ...persistedState }
}

/**
 * Deep merge
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
 * Creates Storage Middleware
 *
 * @param config - Middleware configuration
 * @returns Middleware and hydration API
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
 * // Manual hydration for SSR
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

  // Validate storage key name (security measure)
  validateStorageKeyName(name)

  // Resolve performance configuration
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

  // Get SSR-safe storage
  const getStorage = (): SyncStorage => {
    if (customStorage) {
      // Return synchronous wrapper for async storage
      // Note: Actual async processing needs to be handled separately
      return customStorage as SyncStorage
    }
    return createSafeLocalStorage()
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /**
   * Extracts state to save
   */
  const extractStateToSave = (state: S): Partial<S> => {
    let stateToSave: Partial<S>

    if (partialize) {
      // Select using partialize function
      stateToSave = partialize(state)
    } else if (slices && slices.length > 0) {
      // Select using slices array
      stateToSave = {} as Partial<S>
      for (const sliceName of slices) {
        const value = (state as Record<string, unknown>)[sliceName]
        if (value !== undefined) {
          ;(stateToSave as Record<string, unknown>)[sliceName] = value
        }
      }
    } else {
      // Save entire state
      stateToSave = state
    }

    // Apply exclusion paths
    if (exclude.length > 0) {
      stateToSave = excludePaths(stateToSave as object, exclude) as Partial<S>
    }

    return stateToSave
  }

  /**
   * Saves to storage
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
   * Loads from storage
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

  let saveHandler: ((state: S) => void) | null = null

  const setupSaveHandler = (): void => {
    if (useIdleCallback) {
      const { scheduledFn } = scheduleIdleCallback(saveToStorage, {
        timeout: idleTimeout,
      })
      saveHandler = scheduledFn as (state: S) => void
    } else if (throttleMs) {
      const { throttledFn } = throttle(saveToStorage, throttleMs)
      saveHandler = throttledFn as (state: S) => void
    } else {
      const { debouncedFn } = debounce(saveToStorage, debounceMs)
      saveHandler = debouncedFn as (state: S) => void
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

      // Notify callbacks
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

        // Migration
        if (migrate && persisted.version !== version) {
          state = (await migrate(state, persisted.version)) as S
        }

        // Merge with current state
        if (storeApi) {
          const currentState = storeApi.getState()
          hydratedState = merge(state as Partial<S>, currentState)

          // Update store (dispatch hydration action)
          storeApi.dispatch({
            type: ACTION_HYDRATE_COMPLETE,
            payload: hydratedState,
          } as AnyAction)
        } else {
          hydratedState = state
        }

        // eslint-disable-next-line require-atomic-updates -- Safe to operate in single-threaded environment
        hydrationState = 'hydrated'
        onHydrationComplete?.(hydratedState)

        // Notify completion callbacks
        for (const callback of finishHydrationCallbacks) {
          callback(hydratedState)
        }
      } catch (error) {
        console.error('[redux-storage-middleware] Hydration failed:', error)
        // eslint-disable-next-line require-atomic-updates -- Safe to operate in single-threaded environment
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

      // Call callback immediately if hydration is already complete
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

    // Automatic hydration
    if (!skipHydration && !isServer()) {
      // Execute in microtask (after store initialization)
      Promise.resolve().then(() => {
        api.rehydrate()
      })
    }

    return (next) => (action) => {
      const result = next(action)

      // Handle hydration actions
      if (
        typeof action === 'object' &&
        action !== null &&
        'type' in action &&
        typeof action.type === 'string'
      ) {
        // Update internal state with HYDRATE_COMPLETE action
        if (action.type === ACTION_HYDRATE_COMPLETE) {
          hydrationState = 'hydrated'
          hydratedState = (action as unknown as { payload: S }).payload
          return result
        }

        // Don't save other middleware actions
        if (action.type.startsWith('@@redux-storage-middleware/')) {
          return result
        }
      }

      // Save only after hydration is complete
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
 * Wrapper for backward compatibility with legacy API
 *
 * @deprecated Use createStorageMiddleware instead
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
 * Restores initial state from LocalStorage
 *
 * @param storageKey - LocalStorage key
 * @param serializer - Serializer
 * @returns Restored state or null
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
  // Validate storage key name
  validateStorageKeyName(storageKey)

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
 * Removes state from LocalStorage
 *
 * @param storageKey - LocalStorage key
 */
export function clearStorageState(storageKey: string): void {
  // Validate storage key name
  validateStorageKeyName(storageKey)

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
 * Reducer enhancer for hydration
 *
 * Wraps reducer to handle hydration actions
 *
 * @param reducer - Original reducer
 * @returns Hydration-aware reducer
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
      // Hydration complete: overwrite state
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
