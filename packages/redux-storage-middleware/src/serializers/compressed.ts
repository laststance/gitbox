/**
 * Compressed Serializer
 *
 * Serializer using LZ-String compression
 * Used for efficiently storing large data
 *
 * Note: This serializer requires the lz-string package
 * pnpm add lz-string
 */

import type { Serializer } from '../types'
import { createModuleLoader } from '../utils/moduleLoader'

/**
 * LZString interface (for dynamic import)
 */
interface LZStringModule {
  compressToUTF16: (input: string) => string
  decompressFromUTF16: (input: string) => string | null
  compressToBase64: (input: string) => string
  decompressFromBase64: (input: string) => string | null
  compressToEncodedURIComponent: (input: string) => string
  decompressFromEncodedURIComponent: (input: string) => string | null
}

/**
 * LZ-String module loader
 */
const lzStringLoader = createModuleLoader<LZStringModule>({
  moduleName: 'lz-string',
  importFn: async () => import('lz-string'),
})

/**
 * Initializes compressed serializer
 */
export async function initCompressedSerializer(): Promise<void> {
  await lzStringLoader.load()
}

/**
 * Compression format
 */
export type CompressionFormat = 'utf16' | 'base64' | 'uri'

/**
 * Compressed serializer options
 */
export interface CompressedSerializerOptions {
  /**
   * Compression format
   *
   * - utf16: For localStorage (most efficient)
   * - base64: General purpose
   * - uri: For URLs
   *
   * @default 'utf16'
   */
  format?: CompressionFormat

  /**
   * Replacer for JSON conversion before compression
   */
  replacer?: (key: string, value: unknown) => unknown

  /**
   * Reviver for JSON conversion after decompression
   */
  reviver?: (key: string, value: unknown) => unknown
}

/**
 * Creates compressed serializer
 *
 * @param options - Options
 * @returns Serializer
 *
 * @example
 * ```ts
 * await initCompressedSerializer()
 * const serializer = createCompressedSerializer({ format: 'utf16' })
 *
 * const bigData = { items: Array(10000).fill({ name: 'test' }) }
 * const compressed = serializer.serialize(bigData)
 * // compressed will be significantly smaller
 * ```
 */
export function createCompressedSerializer<T = unknown>(
  options: CompressedSerializerOptions = {},
): Serializer<T> {
  const { format = 'utf16', replacer, reviver } = options

  const compress = (input: string): string => {
    const lz = lzStringLoader.get()
    switch (format) {
      case 'base64':
        return lz.compressToBase64(input)
      case 'uri':
        return lz.compressToEncodedURIComponent(input)
      case 'utf16':
      default:
        return lz.compressToUTF16(input)
    }
  }

  const decompress = (input: string): string | null => {
    const lz = lzStringLoader.get()
    switch (format) {
      case 'base64':
        return lz.decompressFromBase64(input)
      case 'uri':
        return lz.decompressFromEncodedURIComponent(input)
      case 'utf16':
      default:
        return lz.decompressFromUTF16(input)
    }
  }

  return {
    serialize: (state: T): string => {
      try {
        const json = JSON.stringify(state, replacer as never)
        return compress(json)
      } catch (error) {
        console.error(
          '[redux-storage-middleware] Compress serialize error:',
          error,
        )
        throw error
      }
    },
    deserialize: (str: string): T => {
      try {
        const decompressed = decompress(str)
        if (decompressed === null) {
          throw new Error('Failed to decompress data')
        }
        return JSON.parse(decompressed, reviver as never) as T
      } catch (error) {
        console.error(
          '[redux-storage-middleware] Compress deserialize error:',
          error,
        )
        throw error
      }
    },
  }
}

/**
 * Checks if LZ-String is loaded
 */
export function isLZStringLoaded(): boolean {
  return lzStringLoader.isLoaded()
}

/**
 * Calculates compression ratio
 *
 * @param original - Original string before compression
 * @param compressed - Compressed string
 * @returns Compression ratio (0-1, lower is better compression)
 */
export function getCompressionRatio(
  original: string,
  compressed: string,
): number {
  return compressed.length / original.length
}
