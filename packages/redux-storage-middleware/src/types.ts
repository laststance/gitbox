/**
 * Redux Storage Middleware Type Definitions
 *
 * Comprehensive type definitions based on patterns from jotai/zustand
 */

import type { Action, Middleware, Reducer } from '@reduxjs/toolkit'

// =============================================================================
// Storage Types
// =============================================================================

/**
 * Synchronous storage interface
 */
export interface SyncStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

/**
 * Asynchronous storage interface
 */
export interface AsyncStorage {
  getItem: (name: string) => Promise<string | null>
  setItem: (name: string, value: string) => Promise<void>
  removeItem: (name: string) => Promise<void>
}

/**
 * Storage interface (supports both sync and async)
 */
export type StateStorage = SyncStorage | AsyncStorage

// =============================================================================
// Serializer Types
// =============================================================================

/**
 * Serializer interface
 */
export interface Serializer<T = unknown> {
  /**
   * Converts state to JSON string
   */
  serialize: (state: T) => string

  /**
   * Restores state from JSON string
   */
  deserialize: (str: string) => T
}

/**
 * JSON Serializer options
 */
export interface JsonSerializerOptions {
  /**
   * Replacer function passed to JSON.stringify
   */
  replacer?: (key: string, value: unknown) => unknown

  /**
   * Reviver function passed to JSON.parse
   */
  reviver?: (key: string, value: unknown) => unknown

  /**
   * Number of indent spaces (for debugging)
   */
  space?: number
}

// =============================================================================
// Migration Types
// =============================================================================

/**
 * Wrapper for persisted state
 */
export interface PersistedState<T = unknown> {
  /**
   * Schema version
   */
  version: number

  /**
   * Persisted state
   */
  state: T
}

/**
 * Migration function
 */
export type MigrateFn<T = unknown> = (
  persistedState: unknown,
  fromVersion: number,
) => T | Promise<T>

// =============================================================================
// Hydration Types
// =============================================================================

/**
 * Hydration state
 */
export type HydrationState = 'idle' | 'hydrating' | 'hydrated' | 'error'

/**
 * Hydration API
 */
export interface HydrationApi<T = unknown> {
  /**
   * Manually starts hydration
   */
  rehydrate: () => Promise<void>

  /**
   * Returns whether hydration is complete
   */
  hasHydrated: () => boolean

  /**
   * Returns current hydration state
   */
  getHydrationState: () => HydrationState

  /**
   * Gets hydrated state
   */
  getHydratedState: () => T | null

  /**
   * Clears storage
   */
  clearStorage: () => void

  /**
   * Registers callback for hydration completion
   */
  onHydrate: (callback: (state: T) => void) => () => void

  /**
   * Registers callback for hydration completion
   */
  onFinishHydration: (callback: (state: T) => void) => () => void
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  /**
   * Debounce time (milliseconds)
   *
   * @default 300
   */
  debounceMs?: number

  /**
   * Throttle time (milliseconds)
   * Use instead of debounce
   */
  throttleMs?: number

  /**
   * Whether to use requestIdleCallback
   *
   * @default false
   */
  useIdleCallback?: boolean

  /**
   * Idle callback timeout (milliseconds)
   *
   * @default 1000
   */
  idleTimeout?: number
}

/**
 * Complete storage middleware configuration
 */
export interface StorageMiddlewareConfig<S = unknown> {
  /**
   * Root reducer to wrap with hydration handling
   * The middleware will automatically wrap this reducer with hydration support
   *
   * @required
   * @example combineReducers({ settings: settingsReducer, board: boardReducer })
   */
  rootReducer: (state: S | undefined, action: Action) => S

  /**
   * Storage key name
   *
   * @example 'my-app-state'
   */
  name: string

  /**
   * List of slice names to persist
   * If not specified, persists entire state
   *
   * @example ['settings', 'preferences']
   */
  slices?: string[]

  /**
   * Selector function to persist only part of state
   * Based on zustand's partialize pattern
   *
   * @example (state) => ({ user: state.user.profile })
   */
  partialize?: (state: S) => Partial<S>

  /**
   * List of paths to exclude from persistence
   *
   * @example ['auth.token', 'temp']
   */
  exclude?: string[]

  // ---------------------------------------------------------------------------
  // Version & Migration
  // ---------------------------------------------------------------------------

  /**
   * Schema version
   * Increment when state structure changes
   *
   * @default 0
   */
  version?: number

  /**
   * Migration function
   * Converts from old version to new version
   */
  migrate?: MigrateFn<S>

  // ---------------------------------------------------------------------------
  // Storage & Serialization
  // ---------------------------------------------------------------------------

  /**
   * Custom storage
   * If not specified, uses localStorage
   */
  storage?: StateStorage

  /**
   * Custom serializer
   * If not specified, uses JSON.stringify/parse
   */
  serializer?: Serializer<PersistedState<Partial<S>>>

  // ---------------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------------

  /**
   * Performance configuration
   */
  performance?: PerformanceConfig

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Callback when hydration starts
   */
  onHydrate?: () => void

  /**
   * Callback when hydration completes
   */
  onHydrationComplete?: (state: S) => void

  /**
   * Callback when save completes
   */
  onSaveComplete?: (state: S) => void

  /**
   * Callback when error occurs
   */
  onError?: (error: Error, operation: 'load' | 'save' | 'clear') => void

  // ---------------------------------------------------------------------------
  // Merge Strategy
  // ---------------------------------------------------------------------------

  /**
   * Merge function during hydration
   * Defaults to shallow merge
   *
   * @param persistedState - Persisted state
   * @param currentState - Current state
   * @returns Merged state
   */
  merge?: (persistedState: Partial<S>, currentState: S) => S
}

// =============================================================================
// Factory Return Types
// =============================================================================

/**
 * Return value of createStorageMiddleware
 */
export interface StorageMiddlewareResult<S = unknown> {
  /**
   * Redux middleware
   */
  middleware: Middleware<object, S>

  /**
   * Hydration-wrapped reducer
   * Use this as your store's reducer - it handles ACTION_HYDRATE_COMPLETE automatically
   */
  reducer: Reducer<S>

  /**
   * Hydration API
   */
  api: HydrationApi<S>
}

/**
 * Store extension interface
 * Methods added to the store after middleware is applied
 */
export interface StorageStoreExtension<S = unknown> {
  persist: HydrationApi<S>
}

// =============================================================================
// Action Types
// =============================================================================

/**
 * Hydration start action
 */
export interface HydrateStartAction {
  type: '@@redux-storage-middleware/HYDRATE_START'
}

/**
 * Hydration complete action
 */
export interface HydrateCompleteAction<T = unknown> {
  type: '@@redux-storage-middleware/HYDRATE_COMPLETE'
  payload: T
}

/**
 * Hydration error action
 */
export interface HydrateErrorAction {
  type: '@@redux-storage-middleware/HYDRATE_ERROR'
  payload: Error
}

/**
 * Storage middleware related actions
 */
export type StorageMiddlewareAction<T = unknown> =
  | HydrateStartAction
  | HydrateCompleteAction<T>
  | HydrateErrorAction

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Utility type to get nested paths
 */
export type NestedKeyOf<T extends object> = {
  [K in keyof T & (string | number)]: T[K] extends object
    ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
    : `${K}`
}[keyof T & (string | number)]

/**
 * Utility type to get value type from path
 */
export type PathValue<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends object
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never
