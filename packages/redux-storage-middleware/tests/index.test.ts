/**
 * Main Package Export Tests
 *
 * Verifies that all exports from index.ts work correctly
 */

import { describe, expect, it } from 'vitest'

import {
  // Core
  createStorageMiddleware,
  loadStateFromStorage,
  clearStorageState,
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
    it('exports createStorageMiddleware', () => {
      expect(typeof createStorageMiddleware).toBe('function')
    })

    it('exports loadStateFromStorage', () => {
      expect(typeof loadStateFromStorage).toBe('function')
    })

    it('exports clearStorageState', () => {
      expect(typeof clearStorageState).toBe('function')
    })

    it('exports shallowMerge', () => {
      expect(typeof shallowMerge).toBe('function')
    })

    it('exports deepMerge', () => {
      expect(typeof deepMerge).toBe('function')
    })

    it('exports action constants', () => {
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
    it('exports createSafeLocalStorage', () => {
      expect(typeof createSafeLocalStorage).toBe('function')
    })

    it('exports createSafeSessionStorage', () => {
      expect(typeof createSafeSessionStorage).toBe('function')
    })

    it('exports createNoopStorage', () => {
      expect(typeof createNoopStorage).toBe('function')
    })

    it('exports createMemoryStorage', () => {
      expect(typeof createMemoryStorage).toBe('function')
    })

    it('exports toAsyncStorage', () => {
      expect(typeof toAsyncStorage).toBe('function')
    })

    it('exports isValidStorage', () => {
      expect(typeof isValidStorage).toBe('function')
    })

    it('exports getStorageSize', () => {
      expect(typeof getStorageSize).toBe('function')
    })

    it('exports getRemainingStorageQuota', () => {
      expect(typeof getRemainingStorageQuota).toBe('function')
    })
  })

  describe('Serializer exports', () => {
    it('exports createJsonSerializer', () => {
      expect(typeof createJsonSerializer).toBe('function')
    })

    it('exports createEnhancedJsonSerializer', () => {
      expect(typeof createEnhancedJsonSerializer).toBe('function')
    })

    it('exports defaultJsonSerializer', () => {
      expect(defaultJsonSerializer).toHaveProperty('serialize')
      expect(defaultJsonSerializer).toHaveProperty('deserialize')
    })

    it('exports dateReplacer', () => {
      expect(typeof dateReplacer).toBe('function')
    })

    it('exports dateReviver', () => {
      expect(typeof dateReviver).toBe('function')
    })

    it('exports collectionReplacer', () => {
      expect(typeof collectionReplacer).toBe('function')
    })

    it('exports collectionReviver', () => {
      expect(typeof collectionReviver).toBe('function')
    })
  })

  describe('Utility exports', () => {
    it('exports isServer', () => {
      expect(typeof isServer).toBe('function')
    })

    it('exports isBrowser', () => {
      expect(typeof isBrowser).toBe('function')
    })

    it('exports isStorageAvailable', () => {
      expect(typeof isStorageAvailable).toBe('function')
    })

    it('exports isSessionStorageAvailable', () => {
      expect(typeof isSessionStorageAvailable).toBe('function')
    })

    it('exports debounce', () => {
      expect(typeof debounce).toBe('function')
    })

    it('exports debounceLeading', () => {
      expect(typeof debounceLeading).toBe('function')
    })

    it('exports throttle', () => {
      expect(typeof throttle).toBe('function')
    })

    it('exports scheduleIdleCallback', () => {
      expect(typeof scheduleIdleCallback).toBe('function')
    })
  })
})

describe('Serializers Index Exports', () => {
  it('exports all serializers from serializers/index', async () => {
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
  it('exports all utilities from utils/index', async () => {
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
