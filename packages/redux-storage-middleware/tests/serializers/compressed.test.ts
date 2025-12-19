/**
 * Compressed Serializer Tests
 *
 * LZ-String圧縮シリアライザーのテスト
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// モジュールスコープの状態をリセットするために、各テストでモジュールを再インポート
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- 動的インポート用
let compressed: Awaited<typeof import('../../src/serializers/compressed')>

// LZ-Stringモック
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
    it('初期状態ではfalseを返す', async () => {
      compressed = await import('../../src/serializers/compressed')
      expect(compressed.isLZStringLoaded()).toBe(false)
    })
  })

  describe('initCompressedSerializer', () => {
    it('lz-stringがインストールされている場合、正常に初期化される', async () => {
      vi.doMock('lz-string', () => ({ default: mockLZString }))
      compressed = await import('../../src/serializers/compressed')

      await compressed.initCompressedSerializer()

      expect(compressed.isLZStringLoaded()).toBe(true)
    })

    it('lz-stringがインストールされていない場合、エラーをスローする', async () => {
      vi.doMock('lz-string', () => {
        throw new Error('Module not found')
      })
      compressed = await import('../../src/serializers/compressed')

      await expect(compressed.initCompressedSerializer()).rejects.toThrow(
        'lz-string is not installed',
      )
    })

    it('2回目の呼び出しはキャッシュを使用する', async () => {
      vi.doMock('lz-string', () => ({ default: mockLZString }))
      compressed = await import('../../src/serializers/compressed')

      await compressed.initCompressedSerializer()
      await compressed.initCompressedSerializer()

      // キャッシュ済みなのでエラーなし
      expect(compressed.isLZStringLoaded()).toBe(true)
    })
  })

  describe('createCompressedSerializer', () => {
    beforeEach(async () => {
      vi.doMock('lz-string', () => ({ default: mockLZString }))
      compressed = await import('../../src/serializers/compressed')
      await compressed.initCompressedSerializer()
    })

    it('utf16フォーマット（デフォルト）でシリアライズ/デシリアライズできる', () => {
      const serializer = compressed.createCompressedSerializer()
      const data = { name: 'test', count: 42 }

      const serialized = serializer.serialize(data)
      expect(mockLZString.compressToUTF16).toHaveBeenCalled()
      expect(serialized).toContain('utf16:')

      const deserialized = serializer.deserialize(serialized)
      expect(mockLZString.decompressFromUTF16).toHaveBeenCalled()
      expect(deserialized).toEqual(data)
    })

    it('base64フォーマットでシリアライズ/デシリアライズできる', () => {
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

    it('uriフォーマットでシリアライズ/デシリアライズできる', () => {
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

    it('replacer/reviverオプションが機能する', () => {
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

    it('初期化前に使用するとエラーをスローする', async () => {
      vi.resetModules()
      // lz-stringモックを解除してから再インポート
      vi.doUnmock('lz-string')
      compressed = await import('../../src/serializers/compressed')

      const serializer = compressed.createCompressedSerializer()

      expect(() => serializer.serialize({ test: true })).toThrow(
        'LZ-String not loaded',
      )
    })

    it('解凍失敗時にエラーをスローする', async () => {
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

    it('無効なJSONでエラーをスローする', async () => {
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
    it('圧縮率を正しく計算する', async () => {
      compressed = await import('../../src/serializers/compressed')

      const original = 'a'.repeat(100)
      const compressedStr = 'a'.repeat(50)

      const ratio = compressed.getCompressionRatio(original, compressedStr)
      expect(ratio).toBe(0.5)
    })

    it('圧縮なしの場合は1を返す', async () => {
      compressed = await import('../../src/serializers/compressed')

      const original = 'test'
      const compressedStr = 'test'

      const ratio = compressed.getCompressionRatio(original, compressedStr)
      expect(ratio).toBe(1)
    })
  })
})
