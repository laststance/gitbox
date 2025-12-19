/**
 * SuperJSON Serializer Tests
 *
 * SuperJSONシリアライザーのテスト
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as SuperJsonSerializerModule from '../../src/serializers/superjson'

// モジュールスコープの状態をリセットするために、各テストでモジュールを再インポート
let superjsonSerializer: typeof SuperJsonSerializerModule

// SuperJSONモック
const mockSuperJSON = {
  stringify: vi.fn((value: unknown) => {
    // 簡易的なSuperJSON互換の文字列化
    return JSON.stringify({
      json: value,
      meta: { types: {} },
    })
  }),
  parse: vi.fn(<T>(str: string): T => {
    const parsed = JSON.parse(str) as { json: T }
    return parsed.json
  }),
}

describe('SuperJSON Serializer', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isSuperJsonLoaded', () => {
    it('初期状態ではfalseを返す', async () => {
      superjsonSerializer = await import('../../src/serializers/superjson')
      expect(superjsonSerializer.isSuperJsonLoaded()).toBe(false)
    })
  })

  describe('initSuperJsonSerializer', () => {
    it('superjsonがインストールされている場合、正常に初期化される', async () => {
      vi.doMock('superjson', () => ({ default: mockSuperJSON }))
      superjsonSerializer = await import('../../src/serializers/superjson')

      await superjsonSerializer.initSuperJsonSerializer()

      expect(superjsonSerializer.isSuperJsonLoaded()).toBe(true)
    })

    it('superjsonがインストールされていない場合、エラーをスローする', async () => {
      vi.doMock('superjson', () => {
        throw new Error('Module not found')
      })
      superjsonSerializer = await import('../../src/serializers/superjson')

      await expect(
        superjsonSerializer.initSuperJsonSerializer(),
      ).rejects.toThrow('superjson is not installed')
    })

    it('2回目の呼び出しはキャッシュを使用する', async () => {
      vi.doMock('superjson', () => ({ default: mockSuperJSON }))
      superjsonSerializer = await import('../../src/serializers/superjson')

      await superjsonSerializer.initSuperJsonSerializer()
      await superjsonSerializer.initSuperJsonSerializer()

      // キャッシュ済みなのでエラーなし
      expect(superjsonSerializer.isSuperJsonLoaded()).toBe(true)
    })
  })

  describe('createSuperJsonSerializer', () => {
    beforeEach(async () => {
      vi.doMock('superjson', () => ({ default: mockSuperJSON }))
      superjsonSerializer = await import('../../src/serializers/superjson')
      await superjsonSerializer.initSuperJsonSerializer()
    })

    it('オブジェクトをシリアライズ/デシリアライズできる', () => {
      const serializer = superjsonSerializer.createSuperJsonSerializer()
      const data = { name: 'test', count: 42 }

      const serialized = serializer.serialize(data)
      expect(mockSuperJSON.stringify).toHaveBeenCalledWith(data)

      const deserialized = serializer.deserialize(serialized)
      expect(mockSuperJSON.parse).toHaveBeenCalled()
      expect(deserialized).toEqual(data)
    })

    it('配列をシリアライズ/デシリアライズできる', () => {
      const serializer = superjsonSerializer.createSuperJsonSerializer()
      const data = [1, 2, 3, { nested: true }]

      const serialized = serializer.serialize(data)
      const deserialized = serializer.deserialize(serialized)

      expect(deserialized).toEqual(data)
    })

    it('nullを含むデータを処理できる', () => {
      const serializer = superjsonSerializer.createSuperJsonSerializer()
      const data = { value: null, nested: { also: null } }

      const serialized = serializer.serialize(data)
      const deserialized = serializer.deserialize(serialized)

      expect(deserialized).toEqual(data)
    })

    it('初期化前に使用するとエラーをスローする', async () => {
      vi.resetModules()
      vi.doUnmock('superjson')
      superjsonSerializer = await import('../../src/serializers/superjson')

      const serializer = superjsonSerializer.createSuperJsonSerializer()

      expect(() => serializer.serialize({ test: true })).toThrow(
        'SuperJSON not loaded',
      )
    })

    it('シリアライズエラー時にコンソールにエラーを出力する', async () => {
      const failingMockSuperJSON = {
        stringify: vi.fn(() => {
          throw new Error('Stringify failed')
        }),
        parse: mockSuperJSON.parse,
      }
      vi.doMock('superjson', () => ({ default: failingMockSuperJSON }))
      vi.resetModules()
      superjsonSerializer = await import('../../src/serializers/superjson')
      await superjsonSerializer.initSuperJsonSerializer()

      const serializer = superjsonSerializer.createSuperJsonSerializer()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => serializer.serialize({ test: true })).toThrow(
        'Stringify failed',
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SuperJSON serialize error'),
        expect.any(Error),
      )
    })

    it('デシリアライズエラー時にコンソールにエラーを出力する', async () => {
      const failingMockSuperJSON = {
        stringify: mockSuperJSON.stringify,
        parse: vi.fn(() => {
          throw new Error('Parse failed')
        }),
      }
      vi.doMock('superjson', () => ({ default: failingMockSuperJSON }))
      vi.resetModules()
      superjsonSerializer = await import('../../src/serializers/superjson')
      await superjsonSerializer.initSuperJsonSerializer()

      const serializer = superjsonSerializer.createSuperJsonSerializer()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => serializer.deserialize('{"json":{}}}')).toThrow(
        'Parse failed',
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SuperJSON deserialize error'),
        expect.any(Error),
      )
    })
  })

  describe('型付きシリアライザー', () => {
    beforeEach(async () => {
      vi.doMock('superjson', () => ({ default: mockSuperJSON }))
      superjsonSerializer = await import('../../src/serializers/superjson')
      await superjsonSerializer.initSuperJsonSerializer()
    })

    it('ジェネリック型パラメータが機能する', () => {
      interface UserState {
        id: number
        name: string
        active: boolean
      }

      const serializer =
        superjsonSerializer.createSuperJsonSerializer<UserState>()
      const data: UserState = { id: 1, name: 'Alice', active: true }

      const serialized = serializer.serialize(data)
      const deserialized = serializer.deserialize(serialized)

      // 型チェック: deserializedはUserState型として扱える
      expect(deserialized.id).toBe(1)
      expect(deserialized.name).toBe('Alice')
      expect(deserialized.active).toBe(true)
    })
  })
})
