/**
 * JSON Serializer Tests
 */

import { describe, it, expect, vi } from 'vitest'

import {
  createJsonSerializer,
  createEnhancedJsonSerializer,
  defaultJsonSerializer,
  dateReplacer,
  dateReviver,
  collectionReplacer,
  collectionReviver,
} from '../../src/serializers/json'

describe('createJsonSerializer', () => {
  it('can serialize and deserialize objects', () => {
    const serializer = createJsonSerializer()
    const data = { foo: 'bar', num: 42 }

    const serialized = serializer.serialize(data)
    const deserialized = serializer.deserialize(serialized)

    expect(deserialized).toEqual(data)
  })

  it('can serialize and deserialize arrays', () => {
    const serializer = createJsonSerializer()
    const data = [1, 2, 3, 'a', 'b', 'c']

    const serialized = serializer.serialize(data)
    const deserialized = serializer.deserialize(serialized)

    expect(deserialized).toEqual(data)
  })

  it('can handle nested objects', () => {
    const serializer = createJsonSerializer()
    const data = {
      level1: {
        level2: {
          level3: 'deep',
        },
      },
    }

    const serialized = serializer.serialize(data)
    const deserialized = serializer.deserialize(serialized)

    expect(deserialized).toEqual(data)
  })

  it('can use replacer option', () => {
    const replacer = (_key: string, value: unknown) => {
      if (typeof value === 'number') {
        return value * 2
      }
      return value
    }

    const serializer = createJsonSerializer({ replacer })
    const data = { num: 21 }

    const serialized = serializer.serialize(data)

    expect(JSON.parse(serialized)).toEqual({ num: 42 })
  })

  it('can use reviver option', () => {
    const reviver = (_key: string, value: unknown) => {
      if (typeof value === 'number') {
        return value / 2
      }
      return value
    }

    const serializer = createJsonSerializer({ reviver })
    const data = '{"num": 42}'

    const deserialized = serializer.deserialize(data)

    expect(deserialized).toEqual({ num: 21 })
  })

  it('throws exception on serialization error', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const serializer = createJsonSerializer()

    // Object with circular reference
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => serializer.serialize(circular)).toThrow()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('throws exception on deserialization error', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const serializer = createJsonSerializer()

    expect(() => serializer.deserialize('invalid json')).toThrow()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

describe('dateReplacer / dateReviver', () => {
  it('can convert Date object to string and restore', () => {
    const date = new Date('2025-01-01T00:00:00.000Z')
    const replaced = dateReplacer('', date)

    expect(replaced).toEqual({
      __type: 'Date',
      value: '2025-01-01T00:00:00.000Z',
    })

    const revived = dateReviver('', replaced)
    expect(revived).toEqual(date)
  })

  it('returns non-Date values as is', () => {
    expect(dateReplacer('', 'string')).toBe('string')
    expect(dateReplacer('', 42)).toBe(42)
    expect(dateReviver('', 'string')).toBe('string')
  })
})

describe('collectionReplacer / collectionReviver', () => {
  it('can convert Map and restore', () => {
    const map = new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ])
    const replaced = collectionReplacer('', map)

    expect(replaced).toEqual({
      __type: 'Map',
      value: [
        ['key1', 'value1'],
        ['key2', 'value2'],
      ],
    })

    const revived = collectionReviver('', replaced)
    expect(revived).toEqual(map)
  })

  it('can convert Set and restore', () => {
    const set = new Set([1, 2, 3])
    const replaced = collectionReplacer('', set)

    expect(replaced).toEqual({
      __type: 'Set',
      value: [1, 2, 3],
    })

    const revived = collectionReviver('', replaced)
    expect(revived).toEqual(set)
  })

  it('can convert Date and restore', () => {
    const date = new Date('2025-01-01T00:00:00.000Z')
    const replaced = collectionReplacer('', date)

    expect(replaced).toEqual({
      __type: 'Date',
      value: '2025-01-01T00:00:00.000Z',
    })

    const revived = collectionReviver('', replaced)
    expect(revived).toEqual(date)
  })
})

describe('createEnhancedJsonSerializer', () => {
  it('can serialize and deserialize objects containing Date/Map/Set', () => {
    const serializer = createEnhancedJsonSerializer()
    const data = {
      date: new Date('2025-01-01T00:00:00.000Z'),
      map: new Map([['a', 1]]),
      set: new Set(['x', 'y']),
      plain: 'value',
    }

    const serialized = serializer.serialize(data)
    const deserialized = serializer.deserialize(serialized) as typeof data

    // Date is restored - verify with Object.prototype.toString and toISOString
    // since instanceof may fail in jsdom environment
    expect(Object.prototype.toString.call(deserialized.date)).toBe(
      '[object Date]',
    )
    expect((deserialized.date as Date).toISOString()).toBe(
      data.date.toISOString(),
    )
    expect(deserialized.map).toEqual(data.map)
    expect(deserialized.set).toEqual(data.set)
    expect(deserialized.plain).toBe('value')
  })
})

describe('defaultJsonSerializer', () => {
  it('default serializer exists', () => {
    expect(defaultJsonSerializer).toBeDefined()
    expect(typeof defaultJsonSerializer.serialize).toBe('function')
    expect(typeof defaultJsonSerializer.deserialize).toBe('function')
  })
})

describe('Prototype Pollution Protection', () => {
  it('prevents prototype pollution via __proto__ key', () => {
    const serializer = createJsonSerializer()
    const maliciousPayload = '{"__proto__": {"polluted": true}}'

    // Verify Object.prototype is not polluted before deserialization
     
    expect((Object.prototype as any).polluted).toBeUndefined()

    const result = serializer.deserialize(maliciousPayload) as Record<
      string,
      unknown
    >

    // Verify Object.prototype is not polluted after deserialization
     
    expect((Object.prototype as any).polluted).toBeUndefined()

    // Dangerous keys are not added as own properties
    expect(Object.hasOwn(result, '__proto__')).toBe(false)
  })

  it('prevents pollution via constructor.prototype', () => {
    const serializer = createJsonSerializer()
    const maliciousPayload =
      '{"constructor": {"prototype": {"polluted": true}}}'

     
    expect((Object.prototype as any).polluted).toBeUndefined()

    const result = serializer.deserialize(maliciousPayload) as Record<
      string,
      unknown
    >

     
    expect((Object.prototype as any).polluted).toBeUndefined()

    // constructor key is not added as own property
    expect(Object.hasOwn(result, 'constructor')).toBe(false)
  })

  it('filters prototype key', () => {
    const serializer = createJsonSerializer()
    const maliciousPayload = '{"prototype": {"isAdmin": true}}'

    const result = serializer.deserialize(maliciousPayload) as Record<
      string,
      unknown
    >

    // prototype key is not added as own property
    expect(Object.hasOwn(result, 'prototype')).toBe(false)
  })

  it('works with custom reviver', () => {
    // Reviver that doubles numbers
    const reviver = (_key: string, value: unknown) => {
      if (typeof value === 'number') {
        return value * 2
      }
      return value
    }

    const serializer = createJsonSerializer({ reviver })
    const payload = '{"num": 21, "__proto__": {"polluted": true}}'

    const result = serializer.deserialize(payload) as Record<string, unknown>

    // reviver is applied
    expect(result.num).toBe(42)
    // Dangerous keys are not added as own properties
    expect(Object.hasOwn(result, '__proto__')).toBe(false)
     
    expect((Object.prototype as any).polluted).toBeUndefined()
  })

  it('also filters nested dangerous keys', () => {
    const serializer = createJsonSerializer()
    const maliciousPayload =
      '{"data": {"nested": {"__proto__": {"polluted": true}}}}'

    const result = serializer.deserialize(maliciousPayload) as {
      data: { nested: Record<string, unknown> }
    }

     
    expect((Object.prototype as any).polluted).toBeUndefined()
    // Nested __proto__ is also filtered
    expect(Object.hasOwn(result.data.nested, '__proto__')).toBe(false)
  })
})
