/**
 * JSON Serializer
 *
 * 標準的なJSON.stringify/parseを使用するシリアライザー
 */

import type { Serializer, JsonSerializerOptions } from '../types'

/**
 * JSONシリアライザーを作成
 *
 * @param options - シリアライズオプション
 * @returns シリアライザー
 *
 * @example
 * ```ts
 * const serializer = createJsonSerializer()
 * const str = serializer.serialize({ foo: 'bar' })
 * const obj = serializer.deserialize(str)
 * ```
 */
export function createJsonSerializer<T = unknown>(
  options: JsonSerializerOptions = {},
): Serializer<T> {
  const { replacer, reviver, space } = options

  return {
    serialize: (state: T): string => {
      try {
        // replacerがある場合のみJSON.stringifyに渡す
        if (replacer) {
          // Date.prototype.toJSON()がreplacerより先に呼ばれる問題を解決するため、
          // this[key]で元の値にアクセスする必要がある
          /* eslint-disable @typescript-eslint/no-explicit-any */
          return JSON.stringify(
            state,
            function (this: any, key: string, value: unknown) {
              // this[key]で元のオブジェクトにアクセス（Dateの場合、valueは既にISO文字列）
              const originalValue = key ? (this as any)[key] : value
              /* eslint-enable @typescript-eslint/no-explicit-any */
              return replacer(key, originalValue)
            },
            space,
          )
        }
        return JSON.stringify(state, null, space)
      } catch (error) {
        console.error('[redux-storage-middleware] JSON serialize error:', error)
        throw error
      }
    },
    deserialize: (str: string): T => {
      try {
        // reviverがある場合のみJSON.parseに渡す
        if (reviver) {
          return JSON.parse(str, (key, value) => reviver(key, value)) as T
        }
        return JSON.parse(str) as T
      } catch (error) {
        console.error(
          '[redux-storage-middleware] JSON deserialize error:',
          error,
        )
        throw error
      }
    },
  }
}

/**
 * DateオブジェクトをISO文字列に変換するreplacer
 */
export function dateReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() }
  }
  return value
}

/**
 * ISO文字列をDateオブジェクトに復元するreviver
 */
export function dateReviver(_key: string, value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).__type === 'Date'
  ) {
    return new Date((value as Record<string, string>).value)
  }
  return value
}

/**
 * Map/Set対応のreplacer
 */
export function collectionReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __type: 'Map',
      value: Array.from(value.entries()),
    }
  }
  if (value instanceof Set) {
    return {
      __type: 'Set',
      value: Array.from(value.values()),
    }
  }
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() }
  }
  return value
}

/**
 * Map/Set対応のreviver
 */
export function collectionReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (obj.__type === 'Map') {
      return new Map(obj.value as [unknown, unknown][])
    }
    if (obj.__type === 'Set') {
      return new Set(obj.value as unknown[])
    }
    if (obj.__type === 'Date') {
      return new Date(obj.value as string)
    }
  }
  return value
}

/**
 * Date/Map/Set対応のJSONシリアライザー
 */
export function createEnhancedJsonSerializer<T = unknown>(): Serializer<T> {
  return createJsonSerializer<T>({
    replacer: collectionReplacer,
    reviver: collectionReviver,
  })
}

/**
 * デフォルトJSONシリアライザー
 */
export const defaultJsonSerializer = createJsonSerializer()
