/**
 * Redux Storage Middleware Unit Tests
 *
 * Tests for:
 * - createStorageMiddleware: Main middleware factory
 * - loadStateFromStorage: Restore from storage
 * - clearStorageState: Clear storage
 *
 * These tests run in real browser environment via Vitest browser mode.
 * Real localStorage is used instead of jsdom mocks.
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { combineReducers, configureStore, createSlice } from '@reduxjs/toolkit'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  createStorageMiddleware,
  loadStateFromStorage,
  clearStorageState,
} from '../src/middleware'
import { createMemoryStorage } from '../src/storage'
import type { PersistedState } from '../src/types'

// Test Redux slice
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
    // Clear real browser localStorage
    localStorage.clear()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves specified slices to LocalStorage', async () => {
    const rootReducer = combineReducers({
      test: testSlice.reducer,
      settings: settingsSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-state',
      slices: ['test'],
      performance: { debounceMs: 100 },
    })

    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)

    // Dispatch action
    store.dispatch(increment())

    // Wait for debounce
    await vi.advanceTimersByTimeAsync(100)

    // Verify saved to LocalStorage
    const saved = localStorage.getItem('test-state')
    expect(saved).toBeTruthy()

    const parsed = JSON.parse(saved!) as PersistedState
    expect(parsed.state).toHaveProperty('test')
    expect((parsed.state as { test: TestState }).test.value).toBe(1)
    expect(parsed.state).not.toHaveProperty('settings')
  })

  it('can select fine-grained state with partialize function', async () => {
    const rootReducer = combineReducers({
      test: testSlice.reducer,
      settings: settingsSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-partialize',
      partialize: (state: { test: TestState; settings: SettingsState }) => ({
        test: { value: state.test.value, name: '' },
      }),
      performance: { debounceMs: 100 },
    })

    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)
    store.dispatch(setName('should-not-save'))
    store.dispatch(increment())

    await vi.advanceTimersByTimeAsync(100)

    const saved = localStorage.getItem('test-partialize')
    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(1)
    expect((parsed.state as { test: TestState }).test.name).toBe('')
  })

  it('debounces and saves multiple actions', async () => {
    // Spy on real localStorage
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-debounce',
      slices: ['test'],
      performance: { debounceMs: 200 },
    })

    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration and flush all pending timers, then clear mocks
    await vi.runAllTimersAsync()
    setItemSpy.mockClear()

    // Dispatch actions consecutively
    store.dispatch(increment())
    store.dispatch(increment())
    store.dispatch(increment())

    // Not saved during debounce period
    await vi.advanceTimersByTimeAsync(100)
    // Exclude isStorageAvailable() test key and verify actual save count
    const actualSaveCalls = setItemSpy.mock.calls.filter(
      (call) => call[0] !== '__redux_storage_middleware_test__',
    )
    expect(actualSaveCalls).toHaveLength(0)

    // Saved only once after debounce completes
    await vi.advanceTimersByTimeAsync(100)
    const finalSaveCalls = setItemSpy.mock.calls.filter(
      (call) => call[0] !== '__redux_storage_middleware_test__',
    )
    expect(finalSaveCalls).toHaveLength(1)
    expect(finalSaveCalls[0][0]).toBe('test-debounce')

    const saved = localStorage.getItem('test-debounce')
    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(3)

    setItemSpy.mockRestore()
  })

  it('can use throttle with throttleMs option', async () => {
    // Spy on real localStorage
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-throttle',
      slices: ['test'],
      performance: { throttleMs: 200 },
    })

    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration and flush all pending timers, then clear mocks
    await vi.runAllTimersAsync()
    setItemSpy.mockClear()

    // Helper function: Get save count excluding isStorageAvailable() test key
    const getActualSaveCount = () =>
      setItemSpy.mock.calls.filter(
        (call) => call[0] !== '__redux_storage_middleware_test__',
      ).length

    // Immediate save on first action
    store.dispatch(increment())
    expect(getActualSaveCount()).toBe(1)

    // Action within throttle period
    store.dispatch(increment())
    expect(getActualSaveCount()).toBe(1)

    // After throttle period
    await vi.advanceTimersByTimeAsync(200)
    expect(getActualSaveCount()).toBe(2)

    setItemSpy.mockRestore()
  })

  it('can exclude specific paths with exclude option', async () => {
    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-exclude',
      exclude: ['test.name'],
      performance: { debounceMs: 100 },
    })

    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)
    store.dispatch(setName('should-be-excluded'))
    store.dispatch(setValue(42))

    await vi.advanceTimersByTimeAsync(100)

    const saved = localStorage.getItem('test-exclude')
    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(42)
    expect((parsed.state as { test: TestState }).test.name).toBeUndefined()
  })

  it('can perform migration with version and migrate', async () => {
    // Save old version state
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

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-migrate',
      version: 1,
      migrate: migrateFn,
    })

    const _store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration (triggers migration)
    await vi.advanceTimersByTimeAsync(0)

    expect(migrateFn).toHaveBeenCalledWith(
      expect.objectContaining({ test: { value: 10, name: 'old' } }),
      0,
    )
  })

  it('performs auto-hydration by default', async () => {
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 99, name: 'restored' } },
    }
    localStorage.setItem('test-auto-hydrate', JSON.stringify(preloadedState))

    const onHydrationComplete = vi.fn()

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-auto-hydrate',
      onHydrationComplete,
    })

    configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for microtask completion (auto-hydration triggers automatically)
    await vi.advanceTimersByTimeAsync(0)

    expect(onHydrationComplete).toHaveBeenCalled()
  })

  it('calls onSaveComplete callback', async () => {
    const onSaveComplete = vi.fn()

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-onsave',
      slices: ['test'],
      performance: { debounceMs: 100 },
      onSaveComplete,
    })

    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)
    store.dispatch(increment())

    await vi.advanceTimersByTimeAsync(100)

    expect(onSaveComplete).toHaveBeenCalled()
  })

  it('calls onError callback on error', async () => {
    const onError = vi.fn()

    // Custom storage that throws errors (use custom storage option)
    const errorStorage = {
      getItem: (): null => null,
      setItem: (): void => {
        throw new Error('QuotaExceededError')
      },
      removeItem: (): void => {},
    }

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-onerror',
      slices: ['test'],
      performance: { debounceMs: 100 },
      storage: errorStorage,
      onError,
    })

    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)
    store.dispatch(increment())

    await vi.advanceTimersByTimeAsync(100)

    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'save')
  })

  it('can use custom storage', async () => {
    const customStorage = createMemoryStorage()

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'test-custom-storage',
      slices: ['test'],
      storage: customStorage,
      performance: { debounceMs: 100 },
    })

    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)
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
    localStorage.clear()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('api.hasHydrated() correctly reports hydration completion', async () => {
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 10, name: 'restored' } },
    }
    localStorage.setItem('test-has-hydrated', JSON.stringify(preloadedState))

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer, api } = createStorageMiddleware({
      rootReducer,
      name: 'test-has-hydrated',
    })

    configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Initially false before microtask runs
    expect(api.hasHydrated()).toBe(false)

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)

    expect(api.hasHydrated()).toBe(true)
  })

  it('api.getHydrationState() returns correct state', async () => {
    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer, api } = createStorageMiddleware({
      rootReducer,
      name: 'test-hydration-state',
    })

    configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Initially idle before microtask runs
    expect(api.getHydrationState()).toBe('idle')

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)

    expect(api.getHydrationState()).toBe('hydrated')
  })

  it('api.clearStorage() can clear storage', async () => {
    localStorage.setItem(
      'test-clear',
      JSON.stringify({ version: 0, state: {} }),
    )

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer, api } = createStorageMiddleware({
      rootReducer,
      name: 'test-clear',
    })

    configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    expect(localStorage.getItem('test-clear')).toBeTruthy()

    api.clearStorage()

    expect(localStorage.getItem('test-clear')).toBeNull()
  })

  it('api.onFinishHydration() can register callbacks', async () => {
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 42, name: 'test' } },
    }
    localStorage.setItem('test-callback', JSON.stringify(preloadedState))

    const callback = vi.fn()

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer, api } = createStorageMiddleware({
      rootReducer,
      name: 'test-callback',
    })

    configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    const unsubscribe = api.onFinishHydration(callback)

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)

    expect(callback).toHaveBeenCalled()

    // Test unsubscribe
    unsubscribe()
  })

  it('onFinishHydration immediately calls callback if hydration already completed', async () => {
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 1, name: 'test' } },
    }
    localStorage.setItem(
      'test-immediate-callback',
      JSON.stringify(preloadedState),
    )

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    const { middleware, reducer, api } = createStorageMiddleware({
      rootReducer,
      name: 'test-immediate-callback',
    })

    configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)

    const callback = vi.fn()
    api.onFinishHydration(callback)

    expect(callback).toHaveBeenCalled()
  })
})

describe('loadStateFromStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('correctly restores state from LocalStorage', () => {
    const state: PersistedState = {
      version: 0,
      state: { test: { value: 42, name: 'test' } },
    }
    localStorage.setItem('test-load', JSON.stringify(state))

    const loaded = loadStateFromStorage('test-load')
    expect(loaded).toEqual(state)
  })

  it('returns null for non-existent keys', () => {
    const loaded = loadStateFromStorage('non-existent-key')
    expect(loaded).toBeNull()
  })

  it('returns null on JSON parse error', () => {
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
    localStorage.clear()
  })

  it('correctly removes state from LocalStorage', () => {
    localStorage.setItem('test-clear', JSON.stringify({ test: 'data' }))

    expect(localStorage.getItem('test-clear')).toBeTruthy()

    clearStorageState('test-clear')

    expect(localStorage.getItem('test-clear')).toBeNull()
  })

  it('outputs error log on removeItem error using custom storage', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    // Use createStorageMiddleware with custom error storage to test error handling
    const errorStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error('Storage access denied')
      },
    }

    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    // Create middleware with error storage and test clearStorage
    const { api } = createStorageMiddleware({
      rootReducer,
      name: 'test-remove-error',
      storage: errorStorage,
    })

    // This should trigger the error handler
    api.clearStorage()

    // The implementation logs errors via console.error
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

describe('Integration Test: Store with Middleware', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores state from LocalStorage on Store creation and saves changes', async () => {
    // Save initial state to LocalStorage
    const preloadedState: PersistedState = {
      version: 0,
      state: { test: { value: 10, name: 'initial' } },
    }
    localStorage.setItem('integration-test', JSON.stringify(preloadedState))

    // Create root reducer with combineReducers
    const rootReducer = combineReducers({
      test: testSlice.reducer,
    })

    // Create Middleware with new API (rootReducer passed, reducer returned)
    const { middleware, reducer } = createStorageMiddleware({
      rootReducer,
      name: 'integration-test',
      slices: ['test'],
      performance: { debounceMs: 100 },
    })

    // Create Store - use returned reducer (already hydration-wrapped)
    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })

    // Wait for auto-hydration via microtask
    await vi.advanceTimersByTimeAsync(0)
    // Flush all pending timers
    await vi.runAllTimersAsync()

    // Verify initial state was restored
    expect(store.getState().test.value).toBe(10)

    // Change state
    store.dispatch(setValue(20))

    // Wait for debounce
    await vi.advanceTimersByTimeAsync(100)

    // Verify saved to LocalStorage
    const saved = localStorage.getItem('integration-test')
    const parsed = JSON.parse(saved!) as PersistedState
    expect((parsed.state as { test: TestState }).test.value).toBe(20)
  })
})

// =============================================================================
// Storage Key Validation Tests
// =============================================================================

describe('Storage Key Validation', () => {
  // Create a simple rootReducer for validation tests
  const validationRootReducer = combineReducers({
    test: testSlice.reducer,
  })

  describe('createStorageMiddleware', () => {
    it('rejects empty key names', () => {
      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: '',
          slices: ['test'],
        }),
      ).toThrow('[redux-storage-middleware] Storage key name must not be empty')
    })

    it('rejects key names with invalid characters', () => {
      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: 'key with spaces',
          slices: ['test'],
        }),
      ).toThrow('contains invalid characters')

      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: 'key<script>',
          slices: ['test'],
        }),
      ).toThrow('contains invalid characters')

      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: 'key/path',
          slices: ['test'],
        }),
      ).toThrow('contains invalid characters')
    })

    it('rejects reserved key names', () => {
      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: '__proto__',
          slices: ['test'],
        }),
      ).toThrow('is reserved and cannot be used')

      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: 'prototype',
          slices: ['test'],
        }),
      ).toThrow('is reserved and cannot be used')

      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: 'constructor',
          slices: ['test'],
        }),
      ).toThrow('is reserved and cannot be used')
    })

    it('accepts valid key names', () => {
      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: 'my-app-state',
          slices: ['test'],
        }),
      ).not.toThrow()

      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: 'app.settings.v2',
          slices: ['test'],
        }),
      ).not.toThrow()

      expect(() =>
        createStorageMiddleware({
          rootReducer: validationRootReducer,
          name: 'user_preferences_123',
          slices: ['test'],
        }),
      ).not.toThrow()
    })
  })

  describe('loadStateFromStorage', () => {
    it('rejects empty key names', () => {
      expect(() => loadStateFromStorage('')).toThrow(
        '[redux-storage-middleware] Storage key name must not be empty',
      )
    })

    it('rejects reserved key names', () => {
      expect(() => loadStateFromStorage('__proto__')).toThrow(
        'is reserved and cannot be used',
      )
    })
  })

  describe('clearStorageState', () => {
    it('rejects empty key names', () => {
      expect(() => clearStorageState('')).toThrow(
        '[redux-storage-middleware] Storage key name must not be empty',
      )
    })

    it('rejects reserved key names', () => {
      expect(() => clearStorageState('constructor')).toThrow(
        'is reserved and cannot be used',
      )
    })
  })
})
