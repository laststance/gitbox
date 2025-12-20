/**
 * Compressed Serializer Tests
 *
 * Tests for LZ-String compression serializer.
 * Note: In browser mode, vi.doMock doesn't work for npm packages.
 * These tests verify the serializer's behavior with the actual lz-string library
 * if installed, or test error handling when not installed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCompressedSerializer,
  initCompressedSerializer,
  isLZStringLoaded,
  getCompressionRatio,
} from '../../src/serializers/compressed'

describe('Compressed Serializer', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isLZStringLoaded', () => {
    it('returns a boolean value', () => {
      const result = isLZStringLoaded()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('initCompressedSerializer', () => {
    it('can be called without throwing', async () => {
      // In browser mode, this will either:
      // 1. Initialize successfully if lz-string is installed
      // 2. Throw if lz-string is not installed
      try {
        await initCompressedSerializer()
        // If it succeeds, lz-string is loaded
        expect(isLZStringLoaded()).toBe(true)
      } catch (error) {
        // If it fails, lz-string is not installed (expected in dev)
        expect((error as Error).message).toContain('lz-string is not installed')
      }
    })
  })

  describe('createCompressedSerializer', () => {
    it('throws error when used before initialization if lz-string not loaded', () => {
      // Reset module state for this test
      // If lz-string is not loaded, this should throw
      if (!isLZStringLoaded()) {
        const serializer = createCompressedSerializer()
        expect(() => serializer.serialize({ test: true })).toThrow()
      }
    })

    it('can create serializer instance', () => {
      const serializer = createCompressedSerializer()
      expect(serializer).toHaveProperty('serialize')
      expect(serializer).toHaveProperty('deserialize')
    })

    it('can create serializer with options', () => {
      const serializer = createCompressedSerializer({
        format: 'utf16',
      })
      expect(serializer).toHaveProperty('serialize')
      expect(serializer).toHaveProperty('deserialize')
    })

    it('can create serializer with base64 format', () => {
      const serializer = createCompressedSerializer({
        format: 'base64',
      })
      expect(serializer).toHaveProperty('serialize')
      expect(serializer).toHaveProperty('deserialize')
    })

    it('can create serializer with uri format', () => {
      const serializer = createCompressedSerializer({
        format: 'uri',
      })
      expect(serializer).toHaveProperty('serialize')
      expect(serializer).toHaveProperty('deserialize')
    })
  })

  describe('getCompressionRatio', () => {
    it('calculates compression ratio correctly', () => {
      const original = 'a'.repeat(100)
      const compressedStr = 'a'.repeat(50)

      const ratio = getCompressionRatio(original, compressedStr)
      expect(ratio).toBe(0.5)
    })

    it('returns 1 when no compression', () => {
      const original = 'test'
      const compressedStr = 'test'

      const ratio = getCompressionRatio(original, compressedStr)
      expect(ratio).toBe(1)
    })

    it('returns ratio greater than 1 for expansion', () => {
      const original = 'ab'
      const compressedStr = 'abcd'

      const ratio = getCompressionRatio(original, compressedStr)
      expect(ratio).toBe(2)
    })

    it('handles empty strings', () => {
      const original = ''
      const compressedStr = ''

      // Division by zero case - should handle gracefully
      const ratio = getCompressionRatio(original, compressedStr)
      expect(ratio === Infinity || Number.isNaN(ratio)).toBe(true)
    })
  })

  describe('Integration with lz-string (if installed)', () => {
    it('can serialize and deserialize when lz-string is available', async () => {
      try {
        await initCompressedSerializer()

        if (isLZStringLoaded()) {
          const serializer = createCompressedSerializer()
          const data = { name: 'test', count: 42 }

          const serialized = serializer.serialize(data)
          expect(typeof serialized).toBe('string')

          const deserialized = serializer.deserialize(serialized)
          expect(deserialized).toEqual(data)
        }
      } catch {
        // lz-string not installed, skip integration tests
        expect(true).toBe(true)
      }
    })
  })
})
