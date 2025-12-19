/**
 * Compressed Serializer
 *
 * LZ-String圧縮を使用したシリアライザー
 * 大きなデータを効率的に保存するために使用
 *
 * 注意: このシリアライザーを使用するにはlz-stringパッケージが必要です
 * pnpm add lz-string
 */

import type { Serializer } from '../types'

/**
 * LZStringインターフェース（動的インポート用）
 */
interface LZStringModule {
  compressToUTF16: (input: string) => string
  decompressFromUTF16: (input: string) => string | null
  compressToBase64: (input: string) => string
  decompressFromBase64: (input: string) => string | null
  compressToEncodedURIComponent: (input: string) => string
  decompressFromEncodedURIComponent: (input: string) => string | null
}

let lzStringModule: LZStringModule | null = null

/**
 * LZ-Stringを動的にロード
 */
async function loadLZString(): Promise<LZStringModule> {
  if (lzStringModule) {
    return lzStringModule
  }

  try {
    const lzModule = await import('lz-string')
    // eslint-disable-next-line require-atomic-updates -- シングルスレッド環境で安全に動作
    lzStringModule = lzModule.default || lzModule
    return lzStringModule
  } catch {
    throw new Error(
      '[redux-storage-middleware] lz-string is not installed. ' +
        'Please install it with: pnpm add lz-string',
    )
  }
}

/**
 * 同期的にLZ-Stringを取得
 */
function getLZString(): LZStringModule {
  if (!lzStringModule) {
    throw new Error(
      '[redux-storage-middleware] LZ-String not loaded. ' +
        'Call initCompressedSerializer() first.',
    )
  }
  return lzStringModule
}

/**
 * 圧縮シリアライザーを初期化
 */
export async function initCompressedSerializer(): Promise<void> {
  await loadLZString()
}

/**
 * 圧縮フォーマット
 */
export type CompressionFormat = 'utf16' | 'base64' | 'uri'

/**
 * 圧縮シリアライザーオプション
 */
export interface CompressedSerializerOptions {
  /**
   * 圧縮フォーマット
   *
   * - utf16: localStorage向け（最も効率的）
   * - base64: 汎用
   * - uri: URL向け
   *
   * @default 'utf16'
   */
  format?: CompressionFormat

  /**
   * 圧縮前のJSON変換用replacer
   */
  replacer?: (key: string, value: unknown) => unknown

  /**
   * 解凍後のJSON変換用reviver
   */
  reviver?: (key: string, value: unknown) => unknown
}

/**
 * 圧縮シリアライザーを作成
 *
 * @param options - オプション
 * @returns シリアライザー
 *
 * @example
 * ```ts
 * await initCompressedSerializer()
 * const serializer = createCompressedSerializer({ format: 'utf16' })
 *
 * const bigData = { items: Array(10000).fill({ name: 'test' }) }
 * const compressed = serializer.serialize(bigData)
 * // compressed は大幅に小さくなる
 * ```
 */
export function createCompressedSerializer<T = unknown>(
  options: CompressedSerializerOptions = {},
): Serializer<T> {
  const { format = 'utf16', replacer, reviver } = options

  const compress = (input: string): string => {
    const lz = getLZString()
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
    const lz = getLZString()
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
 * LZ-Stringがロード済みかどうかを確認
 */
export function isLZStringLoaded(): boolean {
  return lzStringModule !== null
}

/**
 * 圧縮率を計算
 *
 * @param original - 圧縮前の文字列
 * @param compressed - 圧縮後の文字列
 * @returns 圧縮率（0-1、低いほど圧縮効果が高い）
 */
export function getCompressionRatio(
  original: string,
  compressed: string,
): number {
  return compressed.length / original.length
}
