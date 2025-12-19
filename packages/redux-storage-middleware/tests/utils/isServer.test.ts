/**
 * isServer Utility Tests
 *
 * Tests for SSR detection utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  isServer,
  isBrowser,
  isStorageAvailable,
  isSessionStorageAvailable,
} from '../../src/utils/isServer'

describe('isServer', () => {
  const originalWindow = global.window

  afterEach(() => {
    // Restore window
    if (originalWindow !== undefined) {
      global.window = originalWindow
    }
  })

  it('returns false in browser environment', () => {
    expect(isServer()).toBe(false)
  })

  it('returns true when window is undefined', () => {
    // @ts-expect-error - Set window to undefined
    delete global.window
    expect(isServer()).toBe(true)
    global.window = originalWindow
  })
})

describe('isBrowser', () => {
  it('returns true in browser environment', () => {
    expect(isBrowser()).toBe(true)
  })
})

describe('isStorageAvailable', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      },
    }
  })()

  beforeEach(() => {
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
    localStorageMock.clear()
  })

  it('returns true when localStorage is available', () => {
    expect(isStorageAvailable()).toBe(true)
  })

  it('returns false when localStorage throws error', () => {
    Object.defineProperty(global, 'localStorage', {
      value: {
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
        removeItem: () => {},
      },
      writable: true,
    })

    expect(isStorageAvailable()).toBe(false)
  })

  it('returns false when window is undefined', () => {
    const originalWindow = global.window
    // @ts-expect-error - Set window to undefined
    delete global.window

    expect(isStorageAvailable()).toBe(false)

    global.window = originalWindow
  })
})

describe('isSessionStorageAvailable', () => {
  const sessionStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      },
    }
  })()

  beforeEach(() => {
    Object.defineProperty(global, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
    })
    sessionStorageMock.clear()
  })

  it('returns true when sessionStorage is available', () => {
    expect(isSessionStorageAvailable()).toBe(true)
  })

  it('returns false when sessionStorage throws error', () => {
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
        removeItem: () => {},
      },
      writable: true,
    })

    expect(isSessionStorageAvailable()).toBe(false)
  })
})
