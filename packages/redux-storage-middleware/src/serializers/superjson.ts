/**
 * SuperJSON Serializer
 *
 * High-performance serializer using superjson
 * Automatically handles Date, Map, Set, undefined, BigInt, etc.
 *
 * Note: This serializer requires the superjson package
 * pnpm add superjson
 */

import type { Serializer } from '../types'
import { createModuleLoader } from '../utils/moduleLoader'

/**
 * SuperJSON interface (for dynamic import)
 */
interface SuperJSONModule {
  stringify: (value: unknown) => string
  parse: <T>(str: string) => T
}

/**
 * SuperJSON module loader
 */
const superJsonLoader = createModuleLoader<SuperJSONModule>({
  moduleName: 'superjson',
  importFn: async () => import('superjson'),
})

/**
 * Initializes SuperJSON serializer
 *
 * Must be called once at application startup
 *
 * @example
 * ```ts
 * await initSuperJsonSerializer()
 * const serializer = createSuperJsonSerializer()
 * ```
 */
export async function initSuperJsonSerializer(): Promise<void> {
  await superJsonLoader.load()
}

/**
 * Creates SuperJSON serializer
 *
 * Must call initSuperJsonSerializer() before use
 *
 * @returns Serializer
 *
 * @example
 * ```ts
 * await initSuperJsonSerializer()
 * const serializer = createSuperJsonSerializer()
 *
 * // Automatically handles Date, Map, Set, etc.
 * const data = {
 *   date: new Date(),
 *   map: new Map([['key', 'value']]),
 *   set: new Set([1, 2, 3]),
 *   bigint: BigInt(123),
 * }
 * const str = serializer.serialize(data)
 * const restored = serializer.deserialize(str)
 * ```
 */
export function createSuperJsonSerializer<T = unknown>(): Serializer<T> {
  return {
    serialize: (state: T): string => {
      try {
        const superjson = superJsonLoader.get()
        return superjson.stringify(state)
      } catch (error) {
        console.error(
          '[redux-storage-middleware] SuperJSON serialize error:',
          error,
        )
        throw error
      }
    },
    deserialize: (str: string): T => {
      try {
        const superjson = superJsonLoader.get()
        return superjson.parse<T>(str)
      } catch (error) {
        console.error(
          '[redux-storage-middleware] SuperJSON deserialize error:',
          error,
        )
        throw error
      }
    },
  }
}

/**
 * Checks if SuperJSON is loaded
 */
export function isSuperJsonLoaded(): boolean {
  return superJsonLoader.isLoaded()
}
