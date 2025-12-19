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
  it('オブジェクトをシリアライズ・デシリアライズできる', () => {
    const serializer = createJsonSerializer()
    const data = { foo: 'bar', num: 42 }

    const serialized = serializer.serialize(data)
    const deserialized = serializer.deserialize(serialized)

    expect(deserialized).toEqual(data)
  })

  it('配列をシリアライズ・デシリアライズできる', () => {
    const serializer = createJsonSerializer()
    const data = [1, 2, 3, 'a', 'b', 'c']

    const serialized = serializer.serialize(data)
    const deserialized = serializer.deserialize(serialized)

    expect(deserialized).toEqual(data)
  })

  it('ネストしたオブジェクトを処理できる', () => {
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

  it('replacerオプションを使用できる', () => {
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

  it('reviverオプションを使用できる', () => {
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

  it('シリアライズエラー時に例外を投げる', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const serializer = createJsonSerializer()

    // 循環参照を含むオブジェクト
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => serializer.serialize(circular)).toThrow()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('デシリアライズエラー時に例外を投げる', () => {
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
  it('Dateオブジェクトを文字列に変換して復元できる', () => {
    const date = new Date('2025-01-01T00:00:00.000Z')
    const replaced = dateReplacer('', date)

    expect(replaced).toEqual({
      __type: 'Date',
      value: '2025-01-01T00:00:00.000Z',
    })

    const revived = dateReviver('', replaced)
    expect(revived).toEqual(date)
  })

  it('Date以外の値はそのまま返す', () => {
    expect(dateReplacer('', 'string')).toBe('string')
    expect(dateReplacer('', 42)).toBe(42)
    expect(dateReviver('', 'string')).toBe('string')
  })
})

describe('collectionReplacer / collectionReviver', () => {
  it('Mapを変換して復元できる', () => {
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

  it('Setを変換して復元できる', () => {
    const set = new Set([1, 2, 3])
    const replaced = collectionReplacer('', set)

    expect(replaced).toEqual({
      __type: 'Set',
      value: [1, 2, 3],
    })

    const revived = collectionReviver('', replaced)
    expect(revived).toEqual(set)
  })

  it('Dateを変換して復元できる', () => {
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
  it('Date/Map/Setを含むオブジェクトをシリアライズ・デシリアライズできる', () => {
    const serializer = createEnhancedJsonSerializer()
    const data = {
      date: new Date('2025-01-01T00:00:00.000Z'),
      map: new Map([['a', 1]]),
      set: new Set(['x', 'y']),
      plain: 'value',
    }

    const serialized = serializer.serialize(data)
    const deserialized = serializer.deserialize(serialized) as typeof data

    // Dateは復元される - jsdom環境ではinstanceofが失敗する可能性があるため
    // Object.prototype.toStringとtoISOStringで検証
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
  it('デフォルトシリアライザーが存在する', () => {
    expect(defaultJsonSerializer).toBeDefined()
    expect(typeof defaultJsonSerializer.serialize).toBe('function')
    expect(typeof defaultJsonSerializer.deserialize).toBe('function')
  })
})
