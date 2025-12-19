/**
 * Main Package Export Tests
 *
 * index.tsからの全エクスポートが正しく動作することを確認
 */

import { describe, expect, it } from 'vitest'

import {
  // Core
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
  // Storage
  createSafeLocalStorage,
  createSafeSessionStorage,
  createNoopStorage,
  createMemoryStorage,
  toAsyncStorage,
  isValidStorage,
  getStorageSize,
  getRemainingStorageQuota,
  // Serializers
  createJsonSerializer,
  createEnhancedJsonSerializer,
  defaultJsonSerializer,
  dateReplacer,
  dateReviver,
  collectionReplacer,
  collectionReviver,
  // Utilities
  isServer,
  isBrowser,
  isStorageAvailable,
  isSessionStorageAvailable,
  debounce,
  debounceLeading,
  throttle,
  scheduleIdleCallback,
} from '../src'

describe('Package Exports', () => {
  describe('Core exports', () => {
    it('createStorageMiddleware がエクスポートされている', () => {
      expect(typeof createStorageMiddleware).toBe('function')
    })

    it('createLegacyStorageMiddleware がエクスポートされている', () => {
      expect(typeof createLegacyStorageMiddleware).toBe('function')
    })

    it('loadStateFromStorage がエクスポートされている', () => {
      expect(typeof loadStateFromStorage).toBe('function')
    })

    it('clearStorageState がエクスポートされている', () => {
      expect(typeof clearStorageState).toBe('function')
    })

    it('withHydration がエクスポートされている', () => {
      expect(typeof withHydration).toBe('function')
    })

    it('shallowMerge がエクスポートされている', () => {
      expect(typeof shallowMerge).toBe('function')
    })

    it('deepMerge がエクスポートされている', () => {
      expect(typeof deepMerge).toBe('function')
    })

    it('アクション定数がエクスポートされている', () => {
      expect(ACTION_HYDRATE_START).toBe(
        '@@redux-storage-middleware/HYDRATE_START',
      )
      expect(ACTION_HYDRATE_COMPLETE).toBe(
        '@@redux-storage-middleware/HYDRATE_COMPLETE',
      )
      expect(ACTION_HYDRATE_ERROR).toBe(
        '@@redux-storage-middleware/HYDRATE_ERROR',
      )
    })
  })

  describe('Storage exports', () => {
    it('createSafeLocalStorage がエクスポートされている', () => {
      expect(typeof createSafeLocalStorage).toBe('function')
    })

    it('createSafeSessionStorage がエクスポートされている', () => {
      expect(typeof createSafeSessionStorage).toBe('function')
    })

    it('createNoopStorage がエクスポートされている', () => {
      expect(typeof createNoopStorage).toBe('function')
    })

    it('createMemoryStorage がエクスポートされている', () => {
      expect(typeof createMemoryStorage).toBe('function')
    })

    it('toAsyncStorage がエクスポートされている', () => {
      expect(typeof toAsyncStorage).toBe('function')
    })

    it('isValidStorage がエクスポートされている', () => {
      expect(typeof isValidStorage).toBe('function')
    })

    it('getStorageSize がエクスポートされている', () => {
      expect(typeof getStorageSize).toBe('function')
    })

    it('getRemainingStorageQuota がエクスポートされている', () => {
      expect(typeof getRemainingStorageQuota).toBe('function')
    })
  })

  describe('Serializer exports', () => {
    it('createJsonSerializer がエクスポートされている', () => {
      expect(typeof createJsonSerializer).toBe('function')
    })

    it('createEnhancedJsonSerializer がエクスポートされている', () => {
      expect(typeof createEnhancedJsonSerializer).toBe('function')
    })

    it('defaultJsonSerializer がエクスポートされている', () => {
      expect(defaultJsonSerializer).toHaveProperty('serialize')
      expect(defaultJsonSerializer).toHaveProperty('deserialize')
    })

    it('dateReplacer がエクスポートされている', () => {
      expect(typeof dateReplacer).toBe('function')
    })

    it('dateReviver がエクスポートされている', () => {
      expect(typeof dateReviver).toBe('function')
    })

    it('collectionReplacer がエクスポートされている', () => {
      expect(typeof collectionReplacer).toBe('function')
    })

    it('collectionReviver がエクスポートされている', () => {
      expect(typeof collectionReviver).toBe('function')
    })
  })

  describe('Utility exports', () => {
    it('isServer がエクスポートされている', () => {
      expect(typeof isServer).toBe('function')
    })

    it('isBrowser がエクスポートされている', () => {
      expect(typeof isBrowser).toBe('function')
    })

    it('isStorageAvailable がエクスポートされている', () => {
      expect(typeof isStorageAvailable).toBe('function')
    })

    it('isSessionStorageAvailable がエクスポートされている', () => {
      expect(typeof isSessionStorageAvailable).toBe('function')
    })

    it('debounce がエクスポートされている', () => {
      expect(typeof debounce).toBe('function')
    })

    it('debounceLeading がエクスポートされている', () => {
      expect(typeof debounceLeading).toBe('function')
    })

    it('throttle がエクスポートされている', () => {
      expect(typeof throttle).toBe('function')
    })

    it('scheduleIdleCallback がエクスポートされている', () => {
      expect(typeof scheduleIdleCallback).toBe('function')
    })
  })
})

describe('Serializers Index Exports', () => {
  it('serializers/index から全てのシリアライザーがエクスポートされている', async () => {
    const serializers = await import('../src/serializers')

    expect(typeof serializers.createJsonSerializer).toBe('function')
    expect(typeof serializers.createEnhancedJsonSerializer).toBe('function')
    expect(serializers.defaultJsonSerializer).toBeDefined()
    expect(typeof serializers.dateReplacer).toBe('function')
    expect(typeof serializers.dateReviver).toBe('function')
    expect(typeof serializers.collectionReplacer).toBe('function')
    expect(typeof serializers.collectionReviver).toBe('function')
    expect(typeof serializers.createSuperJsonSerializer).toBe('function')
    expect(typeof serializers.initSuperJsonSerializer).toBe('function')
    expect(typeof serializers.isSuperJsonLoaded).toBe('function')
    expect(typeof serializers.createCompressedSerializer).toBe('function')
    expect(typeof serializers.initCompressedSerializer).toBe('function')
    expect(typeof serializers.isLZStringLoaded).toBe('function')
    expect(typeof serializers.getCompressionRatio).toBe('function')
  })
})

describe('Utils Index Exports', () => {
  it('utils/index から全てのユーティリティがエクスポートされている', async () => {
    const utils = await import('../src/utils')

    expect(typeof utils.isServer).toBe('function')
    expect(typeof utils.isBrowser).toBe('function')
    expect(typeof utils.isStorageAvailable).toBe('function')
    expect(typeof utils.isSessionStorageAvailable).toBe('function')
    expect(typeof utils.debounce).toBe('function')
    expect(typeof utils.debounceLeading).toBe('function')
    expect(typeof utils.throttle).toBe('function')
    expect(typeof utils.scheduleIdleCallback).toBe('function')
  })
})
