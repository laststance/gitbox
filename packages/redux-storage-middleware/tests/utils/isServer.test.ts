/**
 * isServer Utility Tests
 *
 * SSR検出ユーティリティのテスト
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
    // windowを元に戻す
    if (originalWindow !== undefined) {
      global.window = originalWindow
    }
  })

  it('ブラウザ環境ではfalseを返す', () => {
    expect(isServer()).toBe(false)
  })

  it('windowがundefinedの場合はtrueを返す', () => {
    // @ts-expect-error - windowをundefinedに設定
    delete global.window
    expect(isServer()).toBe(true)
    global.window = originalWindow
  })
})

describe('isBrowser', () => {
  it('ブラウザ環境ではtrueを返す', () => {
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

  it('localStorageが利用可能な場合はtrueを返す', () => {
    expect(isStorageAvailable()).toBe(true)
  })

  it('localStorageがエラーを投げる場合はfalseを返す', () => {
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

  it('windowがundefinedの場合はfalseを返す', () => {
    const originalWindow = global.window
    // @ts-expect-error - windowをundefinedに設定
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

  it('sessionStorageが利用可能な場合はtrueを返す', () => {
    expect(isSessionStorageAvailable()).toBe(true)
  })

  it('sessionStorageがエラーを投げる場合はfalseを返す', () => {
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
