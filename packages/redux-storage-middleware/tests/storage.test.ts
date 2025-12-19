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
    // window と global の両方に localStorage をセット
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
    // window.localStorage も同じものを参照させる
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

  it('getItemでlocalStorageから値を取得する', () => {
    localStorageMock.setItem('test', 'value')
    const storage = createSafeLocalStorage()

    expect(storage.getItem('test')).toBe('value')
    expect(localStorageMock.getItem).toHaveBeenCalledWith('test')
  })

  it('setItemでlocalStorageに値を保存する', () => {
    const storage = createSafeLocalStorage()
    storage.setItem('test', 'value')

    expect(localStorageMock.setItem).toHaveBeenCalledWith('test', 'value')
  })

  it('removeItemでlocalStorageから値を削除する', () => {
    const storage = createSafeLocalStorage()
    storage.removeItem('test')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('test')
  })

  it('getItemでエラー発生時はnullを返し警告を出力する', () => {
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

  it('setItemでエラー発生時は警告を出力する', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    // まず正常なstorageでsafeLocalStorageを作成
    const storage = createSafeLocalStorage()

    // その後、エラーを投げるlocalStorageに差し替え
    let _callCount = 0
    const errorStorage = {
      ...localStorageMock,
      setItem: (key: string, _value: string) => {
        // __storage_test__ (isStorageAvailableのテスト) は許可
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

    // 元に戻す
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

  it('removeItemでエラー発生時は警告を出力する', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    // まず正常なstorageでsafeLocalStorageを作成
    const storage = createSafeLocalStorage()

    // その後、エラーを投げるlocalStorageに差し替え
    const errorStorage = {
      ...localStorageMock,
      removeItem: (key: string) => {
        // __storage_test__ (isStorageAvailableのテスト) は許可
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

    // 元に戻す
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
  it('getItemは常にnullを返す', () => {
    const storage = createNoopStorage()
    expect(storage.getItem('any-key')).toBeNull()
  })

  it('setItemは何もしない', () => {
    const storage = createNoopStorage()
    expect(() => storage.setItem('key', 'value')).not.toThrow()
  })

  it('removeItemは何もしない', () => {
    const storage = createNoopStorage()
    expect(() => storage.removeItem('key')).not.toThrow()
  })
})

describe('createMemoryStorage', () => {
  it('値を保存して取得できる', () => {
    const storage = createMemoryStorage()

    storage.setItem('key', 'value')
    expect(storage.getItem('key')).toBe('value')
  })

  it('存在しないキーはnullを返す', () => {
    const storage = createMemoryStorage()
    expect(storage.getItem('non-existent')).toBeNull()
  })

  it('値を削除できる', () => {
    const storage = createMemoryStorage()

    storage.setItem('key', 'value')
    storage.removeItem('key')

    expect(storage.getItem('key')).toBeNull()
  })

  it('複数のキーを独立して管理できる', () => {
    const storage = createMemoryStorage()

    storage.setItem('key1', 'value1')
    storage.setItem('key2', 'value2')

    expect(storage.getItem('key1')).toBe('value1')
    expect(storage.getItem('key2')).toBe('value2')
  })
})

describe('toAsyncStorage', () => {
  it('同期ストレージを非同期ストレージに変換する', async () => {
    const syncStorage = createMemoryStorage()
    const asyncStorage = toAsyncStorage(syncStorage)

    await asyncStorage.setItem('key', 'value')
    const result = await asyncStorage.getItem('key')

    expect(result).toBe('value')
  })

  it('removeItemも非同期で動作する', async () => {
    const syncStorage = createMemoryStorage()
    const asyncStorage = toAsyncStorage(syncStorage)

    await asyncStorage.setItem('key', 'value')
    await asyncStorage.removeItem('key')
    const result = await asyncStorage.getItem('key')

    expect(result).toBeNull()
  })
})

describe('isValidStorage', () => {
  it('有効なストレージオブジェクトでtrueを返す', () => {
    const storage = createMemoryStorage()
    expect(isValidStorage(storage)).toBe(true)
  })

  it('nullでfalseを返す', () => {
    expect(isValidStorage(null)).toBe(false)
  })

  it('undefinedでfalseを返す', () => {
    expect(isValidStorage(undefined)).toBe(false)
  })

  it('オブジェクト以外でfalseを返す', () => {
    expect(isValidStorage('string')).toBe(false)
    expect(isValidStorage(123)).toBe(false)
  })

  it('必要なメソッドがないオブジェクトでfalseを返す', () => {
    expect(isValidStorage({ getItem: () => null })).toBe(false)
    expect(isValidStorage({ getItem: () => null, setItem: () => {} })).toBe(
      false,
    )
  })
})

describe('getStorageSize', () => {
  it('保存された値のサイズを返す', () => {
    const storage = createMemoryStorage()
    storage.setItem('key', 'value')

    // key: 3文字, value: 5文字, UTF-16: (3 + 5) * 2 = 16バイト
    expect(getStorageSize(storage, 'key')).toBe(16)
  })

  it('存在しないキーは0を返す', () => {
    const storage = createMemoryStorage()
    expect(getStorageSize(storage, 'non-existent')).toBe(0)
  })
})
