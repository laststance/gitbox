/**
 * SSR Detection Utility
 *
 * Utility functions for detecting server-side rendering environment
 * Implementation based on patterns from jotai/zustand
 */

/**
 * Determines if the current execution environment is server-side
 *
 * @returns true if server-side, false if browser
 *
 * @example
 * ```ts
 * if (isServer()) {
 *   // SSR processing
 *   return null
 * }
 * // Browser processing
 * localStorage.getItem('key')
 * ```
 */
export function isServer(): boolean {
  return typeof window === 'undefined'
}

/**
 * Determines if the current execution environment is a browser
 *
 * @returns true if browser, false if server-side
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Safely tests if localStorage is available
 *
 * Based on zustand's createJSONStorage pattern, checks:
 * 1. Whether window exists
 * 2. Whether localStorage exists
 * 3. Whether localStorage is actually accessible (e.g., private mode)
 *
 * @returns true if localStorage is available
 *
 * @example
 * ```ts
 * if (!isStorageAvailable()) {
 *   console.warn('localStorage is not available')
 *   return
 * }
 * ```
 */
export function isStorageAvailable(): boolean {
  if (isServer()) {
    return false
  }

  try {
    const testKey = '__redux_storage_middleware_test__'
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    // Private mode or quota exceeded
    return false
  }
}

/**
 * Safely tests if sessionStorage is available
 *
 * @returns true if sessionStorage is available
 */
export function isSessionStorageAvailable(): boolean {
  if (isServer()) {
    return false
  }

  try {
    const testKey = '__redux_storage_middleware_test__'
    window.sessionStorage.setItem(testKey, testKey)
    window.sessionStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}
