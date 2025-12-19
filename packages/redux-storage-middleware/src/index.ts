/**
 * @gitbox/redux-storage-middleware
 *
 * Custom middleware to synchronize Redux state with LocalStorage
 * SSR-safe with version migration and hydration control support
 *
 * @example
 * ```ts
 * import { createStorageMiddleware, withHydration } from '@gitbox/redux-storage-middleware'
 *
 * const { middleware, api } = createStorageMiddleware({
 *   name: 'my-app-state',
 *   slices: ['settings', 'preferences'],
 *   version: 1,
 * })
 *
 * const store = configureStore({
 *   reducer: withHydration(rootReducer),
 *   middleware: (getDefaultMiddleware) =>
 *     getDefaultMiddleware().concat(middleware),
 * })
 *
 * // Check hydration status
 * if (api.hasHydrated()) {
 *   console.log('State restored from localStorage')
 * }
 * ```
 */

// =============================================================================
// Core
// =============================================================================

export {
  createStorageMiddleware,
  createLegacyStorageMiddleware,
  loadStateFromStorage,
  clearStorageState,
  withHydration,
  shallowMerge,
  deepMerge,
  ACTION_HYDRATE_START,
  ACTION_HYDRATE_COMPLETE,
  ACTION_HYDRATE_ERROR,
} from './middleware'

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
  // Migration
  PersistedState,
  MigrateFn,
  // Hydration
  HydrationState,
  HydrationApi,
  // Configuration
  PerformanceConfig,
  StorageMiddlewareConfig,
  LegacyStorageMiddlewareConfig,
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
