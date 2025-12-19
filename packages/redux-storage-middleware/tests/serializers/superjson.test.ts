/**
 * SuperJSON Serializer Tests
 *
 * Tests for SuperJSON serializer
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as SuperJsonSerializerModule from '../../src/serializers/superjson'

// Re-import module in each test to reset module-scoped state
let superjsonSerializer: typeof SuperJsonSerializerModule

// SuperJSON mock
const mockSuperJSON = {
  stringify: vi.fn((value: unknown) => {
    // Simple SuperJSON-compatible stringification
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
    it('returns false in initial state', async () => {
      superjsonSerializer = await import('../../src/serializers/superjson')
      expect(superjsonSerializer.isSuperJsonLoaded()).toBe(false)
    })
  })

  describe('initSuperJsonSerializer', () => {
    it('initializes successfully when superjson is installed', async () => {
      vi.doMock('superjson', () => ({ default: mockSuperJSON }))
      superjsonSerializer = await import('../../src/serializers/superjson')

      await superjsonSerializer.initSuperJsonSerializer()

      expect(superjsonSerializer.isSuperJsonLoaded()).toBe(true)
    })

    it('throws error when superjson is not installed', async () => {
      vi.doMock('superjson', () => {
        throw new Error('Module not found')
      })
      superjsonSerializer = await import('../../src/serializers/superjson')

      await expect(
        superjsonSerializer.initSuperJsonSerializer(),
      ).rejects.toThrow('superjson is not installed')
    })

    it('uses cache on second call', async () => {
      vi.doMock('superjson', () => ({ default: mockSuperJSON }))
      superjsonSerializer = await import('../../src/serializers/superjson')

      await superjsonSerializer.initSuperJsonSerializer()
      await superjsonSerializer.initSuperJsonSerializer()

      // Already cached, so no error
      expect(superjsonSerializer.isSuperJsonLoaded()).toBe(true)
    })
  })

  describe('createSuperJsonSerializer', () => {
    beforeEach(async () => {
      vi.doMock('superjson', () => ({ default: mockSuperJSON }))
      superjsonSerializer = await import('../../src/serializers/superjson')
      await superjsonSerializer.initSuperJsonSerializer()
    })

    it('can serialize and deserialize objects', () => {
      const serializer = superjsonSerializer.createSuperJsonSerializer()
      const data = { name: 'test', count: 42 }

      const serialized = serializer.serialize(data)
      expect(mockSuperJSON.stringify).toHaveBeenCalledWith(data)

      const deserialized = serializer.deserialize(serialized)
      expect(mockSuperJSON.parse).toHaveBeenCalled()
      expect(deserialized).toEqual(data)
    })

    it('can serialize and deserialize arrays', () => {
      const serializer = superjsonSerializer.createSuperJsonSerializer()
      const data = [1, 2, 3, { nested: true }]

      const serialized = serializer.serialize(data)
      const deserialized = serializer.deserialize(serialized)

      expect(deserialized).toEqual(data)
    })

    it('can handle data containing null', () => {
      const serializer = superjsonSerializer.createSuperJsonSerializer()
      const data = { value: null, nested: { also: null } }

      const serialized = serializer.serialize(data)
      const deserialized = serializer.deserialize(serialized)

      expect(deserialized).toEqual(data)
    })

    it('throws error when used before initialization', async () => {
      vi.resetModules()
      vi.doUnmock('superjson')
      superjsonSerializer = await import('../../src/serializers/superjson')

      const serializer = superjsonSerializer.createSuperJsonSerializer()

      expect(() => serializer.serialize({ test: true })).toThrow(
        'superjson not loaded',
      )
    })

    it('outputs error to console on serialization error', async () => {
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

    it('outputs error to console on deserialization error', async () => {
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

  describe('typed serializer', () => {
    beforeEach(async () => {
      vi.doMock('superjson', () => ({ default: mockSuperJSON }))
      superjsonSerializer = await import('../../src/serializers/superjson')
      await superjsonSerializer.initSuperJsonSerializer()
    })

    it('generic type parameters work correctly', () => {
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

      // Type check: deserialized can be treated as UserState type
      expect(deserialized.id).toBe(1)
      expect(deserialized.name).toBe('Alice')
      expect(deserialized.active).toBe(true)
    })
  })
})
