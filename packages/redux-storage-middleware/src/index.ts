/**
 * @gitbox/redux-storage-middleware
 *
 * SSR-safe Redux Toolkit middleware for localStorage persistence
 * Automatic hydration, version migration, and selective slice persistence
 *
 * @example
 * ```ts
 * import { createStorageMiddleware } from '@gitbox/redux-storage-middleware'
 * import { combineReducers, configureStore } from '@reduxjs/toolkit'
 *
 * const rootReducer = combineReducers({
 *   settings: settingsReducer,
 *   board: boardReducer,
 * })
 *
 * const { middleware, reducer, api } = createStorageMiddleware({
 *   rootReducer,  // Required: pass your root reducer
 *   name: 'my-app-state',
 *   slices: ['settings'],
 *   version: 1,
 * })
 *
 * const store = configureStore({
 *   reducer,  // Use the returned reducer (already hydration-wrapped)
 *   middleware: (getDefaultMiddleware) =>
 *     getDefaultMiddleware().concat(middleware),
 * })
 *
 * // Hydration happens automatically on client
 * // Check status with api.hasHydrated()
 * ```
 */

// =============================================================================
// Core
// =============================================================================

export {
  createStorageMiddleware,
  loadStateFromStorage,
  clearStorageState,
  shallowMerge,
  deepMerge,
  ACTION_HYDRATE_START,
  ACTION_HYDRATE_COMPLETE,
  ACTION_HYDRATE_ERROR,
} from './storageMiddleware'

// =============================================================================
// Storage
// =============================================================================

export {
  createSafeLocalStorage,
  createSafeSessionStorage,
  createNoopStorage,
  createMemoryStorage,
  toAsyncStorage,
  isValidStorage,
  getStorageSize,
  getRemainingStorageQuota,
} from './storage'

// =============================================================================
// Serializers
// =============================================================================

export {
  createJsonSerializer,
  createEnhancedJsonSerializer,
  defaultJsonSerializer,
  dateReplacer,
  dateReviver,
  collectionReplacer,
  collectionReviver,
  createSuperJsonSerializer,
  initSuperJsonSerializer,
  isSuperJsonLoaded,
  createCompressedSerializer,
  initCompressedSerializer,
  isLZStringLoaded,
  getCompressionRatio,
  type CompressionFormat,
  type CompressedSerializerOptions,
} from './serializers'

// =============================================================================
// Utilities
// =============================================================================

export {
  isServer,
  isBrowser,
  isStorageAvailable,
  isSessionStorageAvailable,
  debounce,
  debounceLeading,
  throttle,
  scheduleIdleCallback,
} from './utils'

// =============================================================================
// Types
// =============================================================================

export type {
  // Storage
  SyncStorage,
  AsyncStorage,
  StateStorage,
  // Serializer
  Serializer,
  JsonSerializerOptions,
  // Hydration
  HydrationState,
  HydrationApi,
  // Configuration
  PerformanceConfig,
  StorageMiddlewareConfig,
  // Factory
  StorageMiddlewareResult,
  StorageStoreExtension,
  // Actions
  HydrateStartAction,
  HydrateCompleteAction,
  HydrateErrorAction,
  StorageMiddlewareAction,
  // Utility Types
  NestedKeyOf,
  PathValue,
} from './types'
