/**
 * Storage Layer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  createSafeLocalStorage,
  createSafeSessionStorage as _createSafeSessionStorage,
  createNoopStorage,
  createMemoryStorage,
  toAsyncStorage,
  isValidStorage,
  getStorageSize,
  getRemainingStorageQuota,
} from '../src/storage'

describe('createSafeLocalStorage', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: () => {
        store = {}
      },
    }
  })()

  beforeEach(() => {
    // Set localStorage to both window and global
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
    // Make window.localStorage reference the same object
    if (typeof window === 'undefined') {
      Object.defineProperty(global, 'window', {
        value: global,
        writable: true,
        configurable: true,
      })
    } else {
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
      })
    }
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('retrieves value from localStorage with getItem', () => {
    localStorageMock.setItem('test', 'value')
    const storage = createSafeLocalStorage()

    expect(storage.getItem('test')).toBe('value')
    expect(localStorageMock.getItem).toHaveBeenCalledWith('test')
  })

  it('saves value to localStorage with setItem', () => {
    const storage = createSafeLocalStorage()
    storage.setItem('test', 'value')

    expect(localStorageMock.setItem).toHaveBeenCalledWith('test', 'value')
  })

  it('removes value from localStorage with removeItem', () => {
    const storage = createSafeLocalStorage()
    storage.removeItem('test')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('test')
  })

  it('returns null and outputs warning when getItem throws error', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error('Storage error')
    })

    const storage = createSafeLocalStorage()
    const result = storage.getItem('test')

    expect(result).toBeNull()
    expect(consoleWarnSpy).toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('outputs warning when setItem throws error', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    // First create safeLocalStorage with normal storage
    const storage = createSafeLocalStorage()

    // Then replace with localStorage that throws errors
    let _callCount = 0
    const errorStorage = {
      ...localStorageMock,
      setItem: (key: string, _value: string) => {
        // Allow __storage_test__ (isStorageAvailable test)
        if (key === '__storage_test__') {
          return
        }
        _callCount++
        throw new Error('QuotaExceededError')
      },
      removeItem: localStorageMock.removeItem,
    }
    Object.defineProperty(global, 'localStorage', {
      value: errorStorage,
      writable: true,
      configurable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: errorStorage,
        writable: true,
        configurable: true,
      })
    }

    storage.setItem('test', 'value')

    expect(consoleWarnSpy).toHaveBeenCalled()

    // Restore
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
      })
    }
    consoleWarnSpy.mockRestore()
  })

  it('outputs warning when removeItem throws error', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    // First create safeLocalStorage with normal storage
    const storage = createSafeLocalStorage()

    // Then replace with localStorage that throws errors
    const errorStorage = {
      ...localStorageMock,
      removeItem: (key: string) => {
        // Allow __storage_test__ (isStorageAvailable test)
        if (key === '__storage_test__') {
          return
        }
        throw new Error('Storage error')
      },
    }
    Object.defineProperty(global, 'localStorage', {
      value: errorStorage,
      writable: true,
      configurable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: errorStorage,
        writable: true,
        configurable: true,
      })
    }

    storage.removeItem('test')

    expect(consoleWarnSpy).toHaveBeenCalled()

    // Restore
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
      })
    }
    consoleWarnSpy.mockRestore()
  })
})

describe('createNoopStorage', () => {
  it('getItem always returns null', () => {
    const storage = createNoopStorage()
    expect(storage.getItem('any-key')).toBeNull()
  })

  it('setItem does nothing', () => {
    const storage = createNoopStorage()
    expect(() => storage.setItem('key', 'value')).not.toThrow()
  })

  it('removeItem does nothing', () => {
    const storage = createNoopStorage()
    expect(() => storage.removeItem('key')).not.toThrow()
  })
})

describe('createMemoryStorage', () => {
  it('can save and retrieve values', () => {
    const storage = createMemoryStorage()

    storage.setItem('key', 'value')
    expect(storage.getItem('key')).toBe('value')
  })

  it('returns null for non-existent keys', () => {
    const storage = createMemoryStorage()
    expect(storage.getItem('non-existent')).toBeNull()
  })

  it('can remove values', () => {
    const storage = createMemoryStorage()

    storage.setItem('key', 'value')
    storage.removeItem('key')

    expect(storage.getItem('key')).toBeNull()
  })

  it('can manage multiple keys independently', () => {
    const storage = createMemoryStorage()

    storage.setItem('key1', 'value1')
    storage.setItem('key2', 'value2')

    expect(storage.getItem('key1')).toBe('value1')
    expect(storage.getItem('key2')).toBe('value2')
  })
})

describe('toAsyncStorage', () => {
  it('converts sync storage to async storage', async () => {
    const syncStorage = createMemoryStorage()
    const asyncStorage = toAsyncStorage(syncStorage)

    await asyncStorage.setItem('key', 'value')
    const result = await asyncStorage.getItem('key')

    expect(result).toBe('value')
  })

  it('removeItem also works asynchronously', async () => {
    const syncStorage = createMemoryStorage()
    const asyncStorage = toAsyncStorage(syncStorage)

    await asyncStorage.setItem('key', 'value')
    await asyncStorage.removeItem('key')
    const result = await asyncStorage.getItem('key')

    expect(result).toBeNull()
  })
})

describe('isValidStorage', () => {
  it('returns true for valid storage objects', () => {
    const storage = createMemoryStorage()
    expect(isValidStorage(storage)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isValidStorage(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isValidStorage(undefined)).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isValidStorage('string')).toBe(false)
    expect(isValidStorage(123)).toBe(false)
  })

  it('returns false for objects without required methods', () => {
    expect(isValidStorage({ getItem: () => null })).toBe(false)
    expect(isValidStorage({ getItem: () => null, setItem: () => {} })).toBe(
      false,
    )
  })
})

describe('getStorageSize', () => {
  it('returns the size of saved values', () => {
    const storage = createMemoryStorage()
    storage.setItem('key', 'value')

    // key: 3 chars, value: 5 chars, UTF-16: (3 + 5) * 2 = 16 bytes
    expect(getStorageSize(storage, 'key')).toBe(16)
  })

  it('returns 0 for non-existent keys', () => {
    const storage = createMemoryStorage()
    expect(getStorageSize(storage, 'non-existent')).toBe(0)
  })
})

describe('getRemainingStorageQuota', () => {
  const createLocalStorageMock = () => {
    let store: Record<string, string> = {}
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      key: vi.fn((index: number) => Object.keys(store)[index] || null),
      get length() {
        return Object.keys(store).length
      },
      clear: () => {
        store = {}
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns -1 when localStorage is not available', () => {
    // Simulate SSR environment by setting localStorage to undefined
    const originalWindow = global.window
    const originalLocalStorage = global.localStorage

    // @ts-expect-error -- Temporarily set window to undefined for testing
    delete global.window
    // @ts-expect-error -- Temporarily set localStorage to undefined for testing
    delete global.localStorage

    const result = getRemainingStorageQuota()

    expect(result).toBe(-1)

    // Restore
    if (originalWindow !== undefined) {
      global.window = originalWindow
    }
    if (originalLocalStorage !== undefined) {
      global.localStorage = originalLocalStorage
    }
  })

  it('returns estimated remaining bytes', () => {
    const localStorageMock = createLocalStorageMock()

    Object.defineProperty(global, 'window', {
      value: { localStorage: localStorageMock },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })

    const result = getRemainingStorageQuota()

    // Verify it returns a positive value or 0 (large value since storage is empty)
    expect(result).toBeGreaterThanOrEqual(0)
    // Verify test key was removed
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('__quota_test__')
  })

  it('returns -1 when setItem always fails (isStorageAvailable also returns false)', () => {
    const errorStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError')
      }),
      removeItem: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    }

    Object.defineProperty(global, 'window', {
      value: { localStorage: errorStorageMock },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(global, 'localStorage', {
      value: errorStorageMock,
      writable: true,
      configurable: true,
    })

    const result = getRemainingStorageQuota()

    // When setItem always fails, isStorageAvailable() also returns false, so -1
    expect(result).toBe(-1)
  })

  it('returns -1 when exception occurs during current usage calculation', () => {
    let callCount = 0
    const errorStorageMock = {
      getItem: vi.fn((key: string) => {
        // Allow isStorageAvailable test key
        if (key === '__storage_test__') {
          return 'x'
        }
        throw new Error('Storage access denied')
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      key: vi.fn((_index: number) => {
        callCount++
        if (callCount > 1) {
          throw new Error('Storage access denied')
        }
        return 'existing_key'
      }),
      // Set length > 1 to ensure iteration loop executes
      length: 2,
    }

    Object.defineProperty(global, 'window', {
      value: { localStorage: errorStorageMock },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(global, 'localStorage', {
      value: errorStorageMock,
      writable: true,
      configurable: true,
    })

    const result = getRemainingStorageQuota()

    // Returns -1 when getItem or key throws error during iteration
    expect(result).toBe(-1)
  })
})
