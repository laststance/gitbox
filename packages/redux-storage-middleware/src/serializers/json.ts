/**
 * JSON Serializer
 *
 * Serializer using standard JSON.stringify/parse
 */

import type { Serializer, JsonSerializerOptions } from '../types'

/**
 * Set of dangerous keys to prevent prototype pollution attacks
 *
 * Prevents Object.prototype pollution when processing
 * malicious payloads with JSON.parse (e.g., {"__proto__": {"polluted": true}})
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

/**
 * Creates JSON serializer
 *
 * @param options - Serialization options
 * @returns Serializer
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
        // Pass replacer to JSON.stringify only if present
        if (replacer) {
          // To solve the problem of Date.prototype.toJSON() being called before replacer,
          // need to access original value via this[key]
          /* eslint-disable @typescript-eslint/no-explicit-any */
          return JSON.stringify(
            state,
            function (this: any, key: string, value: unknown) {
              // Access original object via this[key] (for Date, value is already ISO string)
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
        // Create safe reviver (prevents prototype pollution)
        const safeReviver = (key: string, value: unknown): unknown => {
          // Filter dangerous keys
          if (DANGEROUS_KEYS.has(key)) {
            return undefined
          }
          // Apply user-provided reviver if present
          return reviver ? reviver(key, value) : value
        }

        return JSON.parse(str, safeReviver) as T
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
 * Replacer to convert Date objects to ISO strings
 */
export function dateReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() }
  }
  return value
}

/**
 * Reviver to restore ISO strings to Date objects
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
 * Replacer supporting Map/Set
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
 * Reviver supporting Map/Set
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
 * JSON serializer supporting Date/Map/Set
 */
export function createEnhancedJsonSerializer<T = unknown>(): Serializer<T> {
  return createJsonSerializer<T>({
    replacer: collectionReplacer,
    reviver: collectionReviver,
  })
}

/**
 * Default JSON serializer
 */
export const defaultJsonSerializer = createJsonSerializer()
