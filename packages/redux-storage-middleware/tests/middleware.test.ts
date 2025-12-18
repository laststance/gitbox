/**
 * Redux Storage Middleware Unit Tests
 *
 * テスト対象:
 * - createStorageMiddleware: LocalStorage 同期ミドルウェア
 * - loadStateFromStorage: LocalStorage からの復元
 * - clearStorageState: LocalStorage クリア
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { configureStore, createSlice } from '@reduxjs/toolkit'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  createStorageMiddleware,
  loadStateFromStorage,
  clearStorageState,
} from '../src/middleware'

// LocalStorage モック
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

// グローバル localStorage をモック
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

// テスト用 Redux slice
interface TestState {
  value: number
}

const testSlice = createSlice({
  name: 'test',
  initialState: { value: 0 } as TestState,
  reducers: {
    increment: (state) => {
      state.value += 1
    },
    setValue: (state, action: PayloadAction<number>) => {
      state.value = action.payload
    },
  },
})

const { increment, setValue } = testSlice.actions

describe('createStorageMiddleware', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('指定された slices を LocalStorage に保存する', async () => {
    const storageKey = 'test-state'
    const middleware = createStorageMiddleware({
      slices: ['test'],
      storageKey,
      debounceMs: 100,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // アクションをディスパッチ
    store.dispatch(increment())

    // デバウンス待機
    await vi.advanceTimersByTimeAsync(100)

    // LocalStorage に保存されたことを確認
    const saved = localStorage.getItem(storageKey)
    expect(saved).toBeTruthy()

    const parsed = JSON.parse(saved!)
    expect(parsed.test.value).toBe(1)
  })

  it('複数回のアクションをデバウンスして保存する', async () => {
    const storageKey = 'test-debounce'
    const setItemSpy = vi.spyOn(localStorage, 'setItem')

    const middleware = createStorageMiddleware({
      slices: ['test'],
      storageKey,
      debounceMs: 200,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // 連続でアクションをディスパッチ
    store.dispatch(increment())
    store.dispatch(increment())
    store.dispatch(increment())

    // デバウンス期間内では保存されない
    await vi.advanceTimersByTimeAsync(100)
    expect(setItemSpy).not.toHaveBeenCalled()

    // デバウンス完了後に1回だけ保存される
    await vi.advanceTimersByTimeAsync(100)
    expect(setItemSpy).toHaveBeenCalledTimes(1)

    const saved = localStorage.getItem(storageKey)
    const parsed = JSON.parse(saved!)
    expect(parsed.test.value).toBe(3)
  })

  it('指定されたslicesのみを保存する', async () => {
    const storageKey = 'test-selective'

    const otherSlice = createSlice({
      name: 'other',
      initialState: { data: 'secret' },
      reducers: {
        updateData: (state, action: PayloadAction<string>) => {
          state.data = action.payload
        },
      },
    })

    const middleware = createStorageMiddleware({
      slices: ['test'], // 'other' は含まない
      storageKey,
      debounceMs: 100,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
        other: otherSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch(increment())
    store.dispatch(otherSlice.actions.updateData('new value'))

    await vi.advanceTimersByTimeAsync(100)

    const saved = localStorage.getItem(storageKey)
    const parsed = JSON.parse(saved!)

    // test slice のみ保存されている
    expect(parsed.test).toBeDefined()
    expect(parsed.other).toBeUndefined()
  })

  it('LocalStorage エラー時にコンソールエラーを出力', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const storageKey = 'test-error'

    // setItem が失敗するようにモック
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const middleware = createStorageMiddleware({
      slices: ['test'],
      storageKey,
      debounceMs: 100,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch(increment())
    await vi.advanceTimersByTimeAsync(100)

    // エラーログが出力されたことを確認
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save state to localStorage:',
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })
})

describe('loadStateFromStorage', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
  })

  it('LocalStorage から state を正しく復元する', () => {
    const storageKey = 'test-load'
    const state = { test: { value: 42 } }

    localStorage.setItem(storageKey, JSON.stringify(state))

    const loaded = loadStateFromStorage(storageKey)
    expect(loaded).toEqual(state)
  })

  it('存在しないキーの場合は null を返す', () => {
    const loaded = loadStateFromStorage('non-existent-key')
    expect(loaded).toBeNull()
  })

  it('JSON パースエラー時に null を返し、エラーログを出力', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const storageKey = 'test-invalid-json'

    localStorage.setItem(storageKey, 'invalid json')

    const loaded = loadStateFromStorage(storageKey)
    expect(loaded).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load state from localStorage:',
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })

  it('getItem エラー時に null を返し、エラーログを出力', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const storageKey = 'test-getitem-error'

    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage access denied')
    })

    const loaded = loadStateFromStorage(storageKey)
    expect(loaded).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load state from localStorage:',
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })
})

describe('clearStorageState', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
  })

  it('LocalStorage から state を正しく削除する', () => {
    const storageKey = 'test-clear'
    localStorage.setItem(storageKey, JSON.stringify({ test: 'data' }))

    expect(localStorage.getItem(storageKey)).toBeTruthy()

    clearStorageState(storageKey)

    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('removeItem エラー時にエラーログを出力', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const storageKey = 'test-remove-error'

    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Storage access denied')
    })

    clearStorageState(storageKey)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to clear state from localStorage:',
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })
})

describe('Integration Test: Store with Middleware', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Store 作成時に LocalStorage から state を復元し、変更を保存する', async () => {
    const storageKey = 'integration-test'

    // 初期状態を LocalStorage に保存
    const preloadedState = { test: { value: 10 } }
    localStorage.setItem(storageKey, JSON.stringify(preloadedState))

    // Middleware 作成
    const middleware = createStorageMiddleware({
      slices: ['test'],
      storageKey,
      debounceMs: 100,
    })

    // Store 作成（preloadedState で復元）
    const loaded = loadStateFromStorage(storageKey) as {
      test: TestState
    } | null
    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      preloadedState: loaded || undefined,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // 初期状態が復元されたことを確認
    expect(store.getState().test.value).toBe(10)

    // 状態を変更
    store.dispatch(setValue(20))

    // デバウンス待機
    await vi.advanceTimersByTimeAsync(100)

    // LocalStorage に保存されたことを確認
    const saved = localStorage.getItem(storageKey)
    const parsed = JSON.parse(saved!)
    expect(parsed.test.value).toBe(20)
  })
})
