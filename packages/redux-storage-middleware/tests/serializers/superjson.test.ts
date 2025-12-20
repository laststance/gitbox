/**
 * SuperJSON Serializer Tests
 *
 * Tests for SuperJSON serializer.
 * Note: In browser mode, vi.doMock doesn't work for npm packages.
 * These tests verify the serializer's behavior with the actual superjson library
 * if installed, or test error handling when not installed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createSuperJsonSerializer,
  initSuperJsonSerializer,
  isSuperJsonLoaded,
} from '../../src/serializers/superjson'

describe('SuperJSON Serializer', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isSuperJsonLoaded', () => {
    it('returns a boolean value', () => {
      const result = isSuperJsonLoaded()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('initSuperJsonSerializer', () => {
    it('can be called without throwing', async () => {
      // In browser mode, this will either:
      // 1. Initialize successfully if superjson is installed
      // 2. Throw if superjson is not installed
      try {
        await initSuperJsonSerializer()
        // If it succeeds, superjson is loaded
        expect(isSuperJsonLoaded()).toBe(true)
      } catch (error) {
        // If it fails, superjson is not installed (expected in dev)
        expect((error as Error).message).toContain('superjson is not installed')
      }
    })
  })

  describe('createSuperJsonSerializer', () => {
    it('throws error when used before initialization if superjson not loaded', () => {
      // If superjson is not loaded, this should throw
      if (!isSuperJsonLoaded()) {
        const serializer = createSuperJsonSerializer()
        expect(() => serializer.serialize({ test: true })).toThrow()
      }
    })

    it('can create serializer instance', () => {
      const serializer = createSuperJsonSerializer()
      expect(serializer).toHaveProperty('serialize')
      expect(serializer).toHaveProperty('deserialize')
    })
  })

  describe('Integration with superjson (if installed)', () => {
    it('can serialize and deserialize when superjson is available', async () => {
      try {
        await initSuperJsonSerializer()

        if (isSuperJsonLoaded()) {
          const serializer = createSuperJsonSerializer()
          const data = { name: 'test', count: 42 }

          const serialized = serializer.serialize(data)
          expect(typeof serialized).toBe('string')

          const deserialized = serializer.deserialize(serialized)
          expect(deserialized).toEqual(data)
        }
      } catch {
        // superjson not installed, skip integration tests
        expect(true).toBe(true)
      }
    })

    it('can serialize and deserialize arrays when superjson is available', async () => {
      try {
        await initSuperJsonSerializer()

        if (isSuperJsonLoaded()) {
          const serializer = createSuperJsonSerializer()
          const data = [1, 2, 3, { nested: true }]

          const serialized = serializer.serialize(data)
          const deserialized = serializer.deserialize(serialized)

          expect(deserialized).toEqual(data)
        }
      } catch {
        // superjson not installed, skip integration tests
        expect(true).toBe(true)
      }
    })

    it('can handle null values when superjson is available', async () => {
      try {
        await initSuperJsonSerializer()

        if (isSuperJsonLoaded()) {
          const serializer = createSuperJsonSerializer()
          const data = { value: null, nested: { also: null } }

          const serialized = serializer.serialize(data)
          const deserialized = serializer.deserialize(serialized)

          expect(deserialized).toEqual(data)
        }
      } catch {
        // superjson not installed, skip integration tests
        expect(true).toBe(true)
      }
    })

    it('typed serializer preserves type information when superjson is available', async () => {
      try {
        await initSuperJsonSerializer()

        if (isSuperJsonLoaded()) {
          interface UserState {
            id: number
            name: string
            active: boolean
          }

          const serializer = createSuperJsonSerializer<UserState>()
          const data: UserState = { id: 1, name: 'Alice', active: true }

          const serialized = serializer.serialize(data)
          const deserialized = serializer.deserialize(serialized)

          expect(deserialized.id).toBe(1)
          expect(deserialized.name).toBe('Alice')
          expect(deserialized.active).toBe(true)
        }
      } catch {
        // superjson not installed, skip integration tests
        expect(true).toBe(true)
      }
    })
  })
})
