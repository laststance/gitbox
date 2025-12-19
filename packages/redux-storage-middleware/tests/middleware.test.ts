/**
 * Redux Storage Middleware Unit Tests
 *
 * テスト対象:
 * - createStorageMiddleware: メインのミドルウェアファクトリ
 * - loadStateFromStorage: ストレージからの復元
 * - clearStorageState: ストレージクリア
 * - withHydration: ハイドレーションreducerエンハンサー
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { configureStore, createSlice } from '@reduxjs/toolkit'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  createStorageMiddleware,
  loadStateFromStorage,
  clearStorageState,
  withHydration,
  ACTION_HYDRATE_COMPLETE,
} from '../src/middleware'
import { createMemoryStorage } from '../src/storage'
import type { PersistedState } from '../src/types'

// LocalStorage モック
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
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] || null,
  }
})()

// グローバル localStorage をモック
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// テスト用 Redux slice
interface TestState {
  value: number
  name: string
}

const testSlice = createSlice({
  name: 'test',
  initialState: { value: 0, name: 'initial' } as TestState,
  reducers: {
    increment: (state) => {
      state.value += 1
    },
    setValue: (state, action: PayloadAction<number>) => {
      state.value = action.payload
    },
    setName: (state, action: PayloadAction<string>) => {
      state.name = action.payload
    },
  },
})

interface SettingsState {
  theme: string
  language: string
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { theme: 'light', language: 'en' } as SettingsState,
  reducers: {
    setTheme: (state, action: PayloadAction<string>) => {
      state.theme = action.payload
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload
    },
  },
})

const { increment, setValue, setName } = testSlice.actions
const { setTheme: _setTheme } = settingsSlice.actions

describe('createStorageMiddleware', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllTimers()
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('指定された slices を LocalStorage に保存する', async () => {
    const { middleware } = createStorageMiddleware({
      name: 'test-state',
      slices: ['test'],
      performance: { debounceMs: 100 },
      skipHydration: true,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
        settings: settingsSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // 手動でハイドレーション完了状態にする
    store.dispatch({ type: ACTION_HYDRATE_COMPLETE, payload: store.getState() })

    // アクションをディスパッチ
    store.dispatch(increment())

    // デバウンス待機
    await vi.advanceTimersByTimeAsync(100)

    // LocalStorage に保存されたことを確認
    const saved = localStorage.getItem('test-state')
    expect(saved).toBeTruthy()

    const parsed = JSON.parse(saved!) as PersistedState
    expect(parsed.state).toHaveProperty('test')
    expect((parsed.state as { test: TestState }).test.value).toBe(1)
    expect(parsed.state).not.toHaveProperty('settings')
  })

  it('partialize関数で細かい状態選択ができる', async () => {
    const { middleware, api: _api } = createStorageMiddleware({
      name: 'test-partialize',
      partialize: (state: { test: TestState; settings: SettingsState }) => ({
        test: { value: state.test.value, name: '' },
      }),
      performance: { debounceMs: 100 },
      skipHydration: true,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
        settings: settingsSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch({ type: ACTION_HYDRATE_COMPLETE, payload: store.getState() })
    store.dispatch(setName('should-not-save'))
    store.dispatch(increment())

    await vi.advanceTimersByTimeAsync(100)

    const saved = localStorage.getItem('test-partialize')
    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(1)
    expect((parsed.state as { test: TestState }).test.name).toBe('')
  })

  it('複数回のアクションをデバウンスして保存する', async () => {
    const { middleware } = createStorageMiddleware({
      name: 'test-debounce',
      slices: ['test'],
      performance: { debounceMs: 200 },
      skipHydration: true,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch({ type: ACTION_HYDRATE_COMPLETE, payload: store.getState() })

    // HYDRATE_COMPLETE後のすべてのpendingタイマーをフラッシュし、モックをクリア
    await vi.runAllTimersAsync()
    localStorageMock.setItem.mockClear()

    // 連続でアクションをディスパッチ
    store.dispatch(increment())
    store.dispatch(increment())
    store.dispatch(increment())

    // デバウンス期間内では保存されない
    await vi.advanceTimersByTimeAsync(100)
    expect(localStorageMock.setItem).not.toHaveBeenCalled()

    // デバウンス完了後に1回だけ保存される
    await vi.advanceTimersByTimeAsync(100)
    // isStorageAvailable()のテストキーを除外して、実際の保存回数を検証
    const actualSaveCalls = localStorageMock.setItem.mock.calls.filter(
      (call) => call[0] !== '__redux_storage_middleware_test__',
    )
    expect(actualSaveCalls).toHaveLength(1)
    expect(actualSaveCalls[0][0]).toBe('test-debounce')

    const saved = localStorage.getItem('test-debounce')
    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(3)
  })

  it('throttleMsオプションでスロットルが使える', async () => {
    const { middleware } = createStorageMiddleware({
      name: 'test-throttle',
      slices: ['test'],
      performance: { throttleMs: 200 },
      skipHydration: true,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch({ type: ACTION_HYDRATE_COMPLETE, payload: store.getState() })

    // HYDRATE_COMPLETE後のすべてのpendingタイマーをフラッシュし、モックをクリア
    await vi.runAllTimersAsync()
    localStorageMock.setItem.mockClear()

    // ヘルパー関数: isStorageAvailable()のテストキーを除外した保存回数を取得
    const getActualSaveCount = () =>
      localStorageMock.setItem.mock.calls.filter(
        (call) => call[0] !== '__redux_storage_middleware_test__',
      ).length

    // 最初のアクションで即時保存
    store.dispatch(increment())
    expect(getActualSaveCount()).toBe(1)

    // スロットル期間内のアクション
    store.dispatch(increment())
    expect(getActualSaveCount()).toBe(1)

    // スロットル期間後
    await vi.advanceTimersByTimeAsync(200)
    expect(getActualSaveCount()).toBe(2)
  })

  it('excludeオプションで特定のパスを除外できる', async () => {
    const { middleware } = createStorageMiddleware({
      name: 'test-exclude',
      exclude: ['test.name'],
      performance: { debounceMs: 100 },
      skipHydration: true,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch({ type: ACTION_HYDRATE_COMPLETE, payload: store.getState() })
    store.dispatch(setName('should-be-excluded'))
    store.dispatch(setValue(42))

    await vi.advanceTimersByTimeAsync(100)

    const saved = localStorage.getItem('test-exclude')
    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(42)
    expect((parsed.state as { test: TestState }).test.name).toBeUndefined()
  })

  it('versionとmigrateでマイグレーションができる', async () => {
    // 古いバージョンの状態を保存
    const oldState: PersistedState = {
      version: 0,
      state: { test: { value: 10, name: 'old' } },
    }
    localStorage.setItem('test-migrate', JSON.stringify(oldState))

    const migrateFn = vi.fn((state, version) => {
      if (version === 0) {
        return { ...state, test: { ...state.test, migrated: true } }
      }
      return state
    })

    const { middleware, api } = createStorageMiddleware({
      name: 'test-migrate',
      version: 1,
      migrate: migrateFn,
      skipHydration: true,
    })

    const _store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // 手動でハイドレーション
    await api.rehydrate()

    expect(migrateFn).toHaveBeenCalledWith(
      expect.objectContaining({ test: { value: 10, name: 'old' } }),
      0,
    )
  })

  it('skipHydration=falseで自動ハイドレーションが行われる', async () => {
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 99, name: 'restored' } },
    }
    localStorage.setItem('test-auto-hydrate', JSON.stringify(preloadedState))

    const onHydrationComplete = vi.fn()

    const { middleware } = createStorageMiddleware({
      name: 'test-auto-hydrate',
      skipHydration: false, // 自動ハイドレーション
      onHydrationComplete,
    })

    configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // マイクロタスクの完了を待つ
    await vi.advanceTimersByTimeAsync(0)

    expect(onHydrationComplete).toHaveBeenCalled()
  })

  it('onSaveCompleteコールバックが呼ばれる', async () => {
    const onSaveComplete = vi.fn()

    const { middleware } = createStorageMiddleware({
      name: 'test-onsave',
      slices: ['test'],
      performance: { debounceMs: 100 },
      onSaveComplete,
      skipHydration: true,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch({ type: ACTION_HYDRATE_COMPLETE, payload: store.getState() })
    store.dispatch(increment())

    await vi.advanceTimersByTimeAsync(100)

    expect(onSaveComplete).toHaveBeenCalled()
  })

  it('onErrorコールバックがエラー時に呼ばれる', async () => {
    const onError = vi.fn()

    // エラーをスローするカスタムストレージ（safeStorageはエラーを握りつぶすため）
    const errorStorage = {
      getItem: (): null => null,
      setItem: (): void => {
        throw new Error('QuotaExceededError')
      },
      removeItem: (): void => {},
    }

    const { middleware } = createStorageMiddleware({
      name: 'test-onerror',
      slices: ['test'],
      performance: { debounceMs: 100 },
      storage: errorStorage,
      onError,
      skipHydration: true,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch({ type: ACTION_HYDRATE_COMPLETE, payload: store.getState() })
    store.dispatch(increment())

    await vi.advanceTimersByTimeAsync(100)

    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'save')
  })

  it('カスタムストレージを使用できる', async () => {
    const customStorage = createMemoryStorage()

    const { middleware } = createStorageMiddleware({
      name: 'test-custom-storage',
      slices: ['test'],
      storage: customStorage,
      performance: { debounceMs: 100 },
      skipHydration: true,
    })

    const store = configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    store.dispatch({ type: ACTION_HYDRATE_COMPLETE, payload: store.getState() })
    store.dispatch(increment())

    await vi.advanceTimersByTimeAsync(100)

    const saved = customStorage.getItem('test-custom-storage')
    expect(saved).toBeTruthy()

    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(1)
  })
})

describe('Hydration API', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllTimers()
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('api.hasHydrated()がハイドレーション完了を正しく報告する', async () => {
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 10, name: 'restored' } },
    }
    localStorage.setItem('test-has-hydrated', JSON.stringify(preloadedState))

    const { middleware, api } = createStorageMiddleware({
      name: 'test-has-hydrated',
      skipHydration: true,
    })

    configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    expect(api.hasHydrated()).toBe(false)

    await api.rehydrate()

    expect(api.hasHydrated()).toBe(true)
  })

  it('api.getHydrationState()が正しい状態を返す', async () => {
    const { middleware, api } = createStorageMiddleware({
      name: 'test-hydration-state',
      skipHydration: true,
    })

    configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    expect(api.getHydrationState()).toBe('idle')

    const promise = api.rehydrate()
    // Note: 状態遷移は同期的なので即座に'hydrated'になる
    await promise

    expect(api.getHydrationState()).toBe('hydrated')
  })

  it('api.clearStorage()でストレージをクリアできる', async () => {
    localStorage.setItem(
      'test-clear',
      JSON.stringify({ version: 0, state: {} }),
    )

    const { middleware, api } = createStorageMiddleware({
      name: 'test-clear',
      skipHydration: true,
    })

    configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    expect(localStorage.getItem('test-clear')).toBeTruthy()

    api.clearStorage()

    expect(localStorage.getItem('test-clear')).toBeNull()
  })

  it('api.onFinishHydration()でコールバックを登録できる', async () => {
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 42, name: 'test' } },
    }
    localStorage.setItem('test-callback', JSON.stringify(preloadedState))

    const callback = vi.fn()

    const { middleware, api } = createStorageMiddleware({
      name: 'test-callback',
      skipHydration: true,
    })

    configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    const unsubscribe = api.onFinishHydration(callback)

    await api.rehydrate()

    expect(callback).toHaveBeenCalled()

    // unsubscribeのテスト
    unsubscribe()
  })

  it('既にハイドレーション完了済みの場合、onFinishHydrationは即座にコールバックを呼ぶ', async () => {
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 1, name: 'test' } },
    }
    localStorage.setItem(
      'test-immediate-callback',
      JSON.stringify(preloadedState),
    )

    const { middleware, api } = createStorageMiddleware({
      name: 'test-immediate-callback',
      skipHydration: true,
    })

    configureStore({
      reducer: {
        test: testSlice.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    await api.rehydrate()

    const callback = vi.fn()
    api.onFinishHydration(callback)

    expect(callback).toHaveBeenCalled()
  })
})

describe('loadStateFromStorage', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
  })

  it('LocalStorage から state を正しく復元する', () => {
    const state: PersistedState = {
      version: 0,
      state: { test: { value: 42, name: 'test' } },
    }
    localStorage.setItem('test-load', JSON.stringify(state))

    const loaded = loadStateFromStorage('test-load')
    expect(loaded).toEqual(state)
  })

  it('存在しないキーの場合は null を返す', () => {
    const loaded = loadStateFromStorage('non-existent-key')
    expect(loaded).toBeNull()
  })

  it('JSON パースエラー時に null を返す', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    localStorage.setItem('test-invalid-json', 'invalid json')

    const loaded = loadStateFromStorage('test-invalid-json')
    expect(loaded).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

describe('clearStorageState', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
  })

  it('LocalStorage から state を正しく削除する', () => {
    localStorage.setItem('test-clear', JSON.stringify({ test: 'data' }))

    expect(localStorage.getItem('test-clear')).toBeTruthy()

    clearStorageState('test-clear')

    expect(localStorage.getItem('test-clear')).toBeNull()
  })

  it('removeItem エラー時に警告ログを出力', () => {
    // safeLocalStorageはエラーをcatchして警告を出力する
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    // window.localStorageをエラースローするものに置換
    // isStorageAvailableのテスト(__redux_storage_middleware_test__)は許可
    const errorStorage = {
      getItem: () => null,
      setItem: () => {
        // availability checkは許可
      },
      removeItem: (key: string) => {
        // isStorageAvailable() で使われるテストキーは許可
        if (key === '__redux_storage_middleware_test__') {
          return
        }
        throw new Error('Storage access denied')
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

    clearStorageState('test-remove-error')

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

describe('withHydration', () => {
  it('HYDRATE_COMPLETEアクションで状態を上書きする', () => {
    const reducer = (state = { value: 0 }, action: { type: string }) => {
      if (action.type === 'INCREMENT') {
        return { value: state.value + 1 }
      }
      return state
    }

    const enhancedReducer = withHydration(reducer)

    const newState = { value: 100 }
    const result = enhancedReducer(
      { value: 0 },
      { type: ACTION_HYDRATE_COMPLETE, payload: newState },
    )

    expect(result).toEqual(newState)
  })

  it('通常のアクションは元のreducerに渡される', () => {
    const reducer = (state = { value: 0 }, action: { type: string }) => {
      if (action.type === 'INCREMENT') {
        return { value: state.value + 1 }
      }
      return state
    }

    const enhancedReducer = withHydration(reducer)

    const result = enhancedReducer({ value: 5 }, { type: 'INCREMENT' })

    expect(result).toEqual({ value: 6 })
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
    // 初期状態を LocalStorage に保存
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 10, name: 'initial' } },
    }
    localStorage.setItem('integration-test', JSON.stringify(preloadedState))

    // Middleware 作成
    const { middleware, api } = createStorageMiddleware({
      name: 'integration-test',
      slices: ['test'],
      performance: { debounceMs: 100 },
      skipHydration: true,
    })

    // combineReducersでルートreducerを作成し、withHydrationを適用
    const rootReducer = (
      state: { test: TestState } = { test: { value: 0, name: 'initial' } },
      action: { type: string; payload?: unknown },
    ) => {
      return {
        test: testSlice.reducer(
          state.test,
          action as PayloadAction<number | string>,
        ),
      }
    }

    // Store 作成 - withHydrationはルートレベルで適用
    const store = configureStore({
      reducer: withHydration(rootReducer),
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // 手動でハイドレーション
    await api.rehydrate()
    // fake timers環境でmicrotaskをフラッシュ
    await vi.runAllTimersAsync()

    // 初期状態が復元されたことを確認
    expect(store.getState().test.value).toBe(10)

    // 状態を変更
    store.dispatch(setValue(20))

    // デバウンス待機
    await vi.advanceTimersByTimeAsync(100)

    // LocalStorage に保存されたことを確認
    const saved = localStorage.getItem('integration-test')
    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(20)
  })
})
