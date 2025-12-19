/**
 * Compressed Serializer Tests
 *
 * Tests for LZ-String compression serializer
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Re-import module in each test to reset module-scoped state
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- For dynamic import
let compressed: Awaited<typeof import('../../src/serializers/compressed')>

// LZ-String mock
const mockLZString = {
  compressToUTF16: vi.fn((input: string) => `utf16:${input}`),
  decompressFromUTF16: vi.fn((input: string) => input.replace('utf16:', '')),
  compressToBase64: vi.fn((input: string) => `base64:${input}`),
  decompressFromBase64: vi.fn((input: string) => input.replace('base64:', '')),
  compressToEncodedURIComponent: vi.fn((input: string) => `uri:${input}`),
  decompressFromEncodedURIComponent: vi.fn((input: string) =>
    input.replace('uri:', ''),
  ),
}

describe('Compressed Serializer', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isLZStringLoaded', () => {
    it('returns false in initial state', async () => {
      compressed = await import('../../src/serializers/compressed')
      expect(compressed.isLZStringLoaded()).toBe(false)
    })
  })

  describe('initCompressedSerializer', () => {
    it('initializes successfully when lz-string is installed', async () => {
      vi.doMock('lz-string', () => ({ default: mockLZString }))
      compressed = await import('../../src/serializers/compressed')

      await compressed.initCompressedSerializer()

      expect(compressed.isLZStringLoaded()).toBe(true)
    })

    it('throws error when lz-string is not installed', async () => {
      vi.doMock('lz-string', () => {
        throw new Error('Module not found')
      })
      compressed = await import('../../src/serializers/compressed')

      await expect(compressed.initCompressedSerializer()).rejects.toThrow(
        'lz-string is not installed',
      )
    })

    it('uses cache on second call', async () => {
      vi.doMock('lz-string', () => ({ default: mockLZString }))
      compressed = await import('../../src/serializers/compressed')

      await compressed.initCompressedSerializer()
      await compressed.initCompressedSerializer()

      // Already cached, so no error
      expect(compressed.isLZStringLoaded()).toBe(true)
    })
  })

  describe('createCompressedSerializer', () => {
    beforeEach(async () => {
      vi.doMock('lz-string', () => ({ default: mockLZString }))
      compressed = await import('../../src/serializers/compressed')
      await compressed.initCompressedSerializer()
    })

    it('can serialize/deserialize in utf16 format (default)', () => {
      const serializer = compressed.createCompressedSerializer()
      const data = { name: 'test', count: 42 }

      const serialized = serializer.serialize(data)
      expect(mockLZString.compressToUTF16).toHaveBeenCalled()
      expect(serialized).toContain('utf16:')

      const deserialized = serializer.deserialize(serialized)
      expect(mockLZString.decompressFromUTF16).toHaveBeenCalled()
      expect(deserialized).toEqual(data)
    })

    it('can serialize/deserialize in base64 format', () => {
      const serializer = compressed.createCompressedSerializer({
        format: 'base64',
      })
      const data = { name: 'test' }

      const serialized = serializer.serialize(data)
      expect(mockLZString.compressToBase64).toHaveBeenCalled()
      expect(serialized).toContain('base64:')

      const deserialized = serializer.deserialize(serialized)
      expect(mockLZString.decompressFromBase64).toHaveBeenCalled()
      expect(deserialized).toEqual(data)
    })

    it('can serialize/deserialize in uri format', () => {
      const serializer = compressed.createCompressedSerializer({
        format: 'uri',
      })
      const data = { name: 'test' }

      const serialized = serializer.serialize(data)
      expect(mockLZString.compressToEncodedURIComponent).toHaveBeenCalled()
      expect(serialized).toContain('uri:')

      const deserialized = serializer.deserialize(serialized)
      expect(mockLZString.decompressFromEncodedURIComponent).toHaveBeenCalled()
      expect(deserialized).toEqual(data)
    })

    it('replacer/reviver options work correctly', () => {
      const replacer = vi.fn((_key: string, value: unknown) => {
        if (typeof value === 'string') return value.toUpperCase()
        return value
      })
      const reviver = vi.fn((_key: string, value: unknown) => {
        if (typeof value === 'string' && value !== '')
          return value.toLowerCase()
        return value
      })

      const serializer = compressed.createCompressedSerializer({
        replacer,
        reviver,
      })
      const data = { name: 'Test' }

      const serialized = serializer.serialize(data)
      expect(replacer).toHaveBeenCalled()

      const deserialized = serializer.deserialize(serialized)
      expect(reviver).toHaveBeenCalled()
      expect((deserialized as { name: string }).name).toBe('test')
    })

    it('throws error when used before initialization', async () => {
      vi.resetModules()
      // Unmock lz-string before re-importing
      vi.doUnmock('lz-string')
      compressed = await import('../../src/serializers/compressed')

      const serializer = compressed.createCompressedSerializer()

      expect(() => serializer.serialize({ test: true })).toThrow(
        'lz-string not loaded',
      )
    })

    it('throws error on decompression failure', async () => {
      const failingMockLZString = {
        ...mockLZString,
        decompressFromUTF16: vi.fn(() => null),
      }
      vi.doMock('lz-string', () => ({ default: failingMockLZString }))
      vi.resetModules()
      compressed = await import('../../src/serializers/compressed')
      await compressed.initCompressedSerializer()

      const serializer = compressed.createCompressedSerializer()

      expect(() => serializer.deserialize('invalid')).toThrow(
        'Failed to decompress data',
      )
    })

    it('throws error on invalid JSON', async () => {
      const invalidJsonMockLZString = {
        ...mockLZString,
        decompressFromUTF16: vi.fn(() => 'not valid json'),
      }
      vi.doMock('lz-string', () => ({ default: invalidJsonMockLZString }))
      vi.resetModules()
      compressed = await import('../../src/serializers/compressed')
      await compressed.initCompressedSerializer()

      const serializer = compressed.createCompressedSerializer()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => serializer.deserialize('something')).toThrow()
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('getCompressionRatio', () => {
    it('calculates compression ratio correctly', async () => {
      compressed = await import('../../src/serializers/compressed')

      const original = 'a'.repeat(100)
      const compressedStr = 'a'.repeat(50)

      const ratio = compressed.getCompressionRatio(original, compressedStr)
      expect(ratio).toBe(0.5)
    })

    it('returns 1 when no compression', async () => {
      compressed = await import('../../src/serializers/compressed')

      const original = 'test'
      const compressedStr = 'test'

      const ratio = compressed.getCompressionRatio(original, compressedStr)
      expect(ratio).toBe(1)
    })
  })
})
