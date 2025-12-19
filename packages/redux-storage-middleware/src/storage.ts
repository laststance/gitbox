/**
 * Storage Abstraction Layer
 *
 * Storage layer providing safe access to localStorage
 * Prevents crashes in SSR environments and supports custom storage backends
 */

import type { StateStorage, SyncStorage, AsyncStorage } from './types'
import { isStorageAvailable, isSessionStorageAvailable } from './utils/isServer'

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum number of doublings for test data during quota estimation
 *
 * 22 doublings reaches approximately 4MB (1 * 2^22 = 4,194,304 bytes)
 * This is close to the typical localStorage limit of 5MB
 */
const MAX_STORAGE_SIZE_DOUBLINGS = 22

// =============================================================================
// Generic Storage Factory (Internal Use)
// =============================================================================

/**
 * Generic factory to create SSR-safe storage wrapper
 *
 * @param getBackend - Function to get storage backend
 * @param isAvailable - Function to check storage availability
 * @param storageName - Storage name for error messages
 * @returns SSR-safe Storage object
 */
function createSafeStorage(
  getBackend: () => Storage,
  isAvailable: () => boolean,
  storageName: string,
): SyncStorage {
  if (!isAvailable()) {
    return createNoopStorage()
  }

  return {
    getItem: (name: string): string | null => {
      try {
        return getBackend().getItem(name)
      } catch {
        console.warn(
          `[redux-storage-middleware] Failed to read from ${storageName}: ${name}`,
        )
        return null
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        getBackend().setItem(name, value)
      } catch (error) {
        console.warn(
          `[redux-storage-middleware] Failed to write to ${storageName}: ${name}`,
          error,
        )
      }
    },
    removeItem: (name: string): void => {
      try {
        getBackend().removeItem(name)
      } catch {
        console.warn(
          `[redux-storage-middleware] Failed to remove from ${storageName}: ${name}`,
        )
      }
    },
  }
}

// =============================================================================
// Public Storage Factories
// =============================================================================

/**
 * Creates SSR-safe localStorage wrapper
 *
 * Implementation based on zustand's createJSONStorage pattern
 * Returns noop storage in server-side or unsupported environments
 *
 * @returns SSR-safe Storage object
 *
 * @example
 * ```ts
 * const storage = createSafeLocalStorage()
 * storage.setItem('key', 'value') // Does nothing during SSR
 * ```
 */
export function createSafeLocalStorage(): SyncStorage {
  return createSafeStorage(
    () => window.localStorage,
    isStorageAvailable,
    'localStorage',
  )
}

/**
 * Creates SSR-safe sessionStorage wrapper
 *
 * @returns SSR-safe Storage object
 */
export function createSafeSessionStorage(): SyncStorage {
  return createSafeStorage(
    () => window.sessionStorage,
    isSessionStorageAvailable,
    'sessionStorage',
  )
}

/**
 * Creates no-op storage
 *
 * Used in SSR environments or unsupported environments
 *
 * @returns Noop storage object
 */
export function createNoopStorage(): SyncStorage {
  return {
    getItem: (): null => null,
    setItem: (): void => {},
    removeItem: (): void => {},
  }
}

/**
 * Creates in-memory storage
 *
 * In-memory storage for testing or SSR fallback
 *
 * @returns In-memory storage object
 */
export function createMemoryStorage(): SyncStorage {
  const store = new Map<string, string>()

  return {
    getItem: (name: string): string | null => store.get(name) ?? null,
    setItem: (name: string, value: string): void => {
      store.set(name, value)
    },
    removeItem: (name: string): void => {
      store.delete(name)
    },
  }
}

/**
 * Converts sync storage to async storage
 *
 * @param storage - Sync storage
 * @returns Async storage
 */
export function toAsyncStorage(storage: SyncStorage): AsyncStorage {
  return {
    getItem: async (name: string): Promise<string | null> =>
      storage.getItem(name),
    setItem: async (name: string, value: string): Promise<void> =>
      storage.setItem(name, value),
    removeItem: async (name: string): Promise<void> => storage.removeItem(name),
  }
}

/**
 * Validates StateStorage
 *
 * @param storage - Storage to validate
 * @returns True if storage is valid
 */
export function isValidStorage(storage: unknown): storage is StateStorage {
  if (storage === null || storage === undefined) {
    return false
  }

  if (typeof storage !== 'object') {
    return false
  }

  const s = storage as Record<string, unknown>
  return (
    typeof s.getItem === 'function' &&
    typeof s.setItem === 'function' &&
    typeof s.removeItem === 'function'
  )
}

/**
 * Gets storage size (approximate)
 *
 * @param storage - Storage
 * @param key - Key
 * @returns Number of bytes
 */
export function getStorageSize(storage: SyncStorage, key: string): number {
  const value = storage.getItem(key)
  if (value === null) {
    return 0
  }
  // Considers UTF-16 encoding (JavaScript strings are 2 bytes per character)
  return key.length * 2 + value.length * 2
}

/**
 * Gets remaining localStorage quota (approximate)
 *
 * @returns Remaining bytes (-1 if unavailable)
 */
export function getRemainingStorageQuota(): number {
  if (!isStorageAvailable()) {
    return -1
  }

  try {
    // Estimate remaining capacity with test data over 5MB
    const testKey = '__quota_test__'
    let testData = 'a'
    let maxSize = 0

    // Gradually increase to find limit (up to about 5MB)
    for (let i = 0; i < MAX_STORAGE_SIZE_DOUBLINGS; i++) {
      try {
        window.localStorage.setItem(testKey, testData)
        maxSize = testData.length
        testData = testData + testData // Double the size
      } catch {
        break
      }
    }

    window.localStorage.removeItem(testKey)

    // Subtract current usage as approximation
    let currentUsage = 0
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key) {
        const value = window.localStorage.getItem(key)
        if (value) {
          currentUsage += key.length + value.length
        }
      }
    }

    // Consider UTF-16
    return (maxSize - currentUsage) * 2
  } catch {
    return -1
  }
}
