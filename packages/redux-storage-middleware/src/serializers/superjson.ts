/**
 * SuperJSON Serializer
 *
 * superjsonを使用した高機能シリアライザー
 * Date, Map, Set, undefined, BigIntなどを自動的に処理
 *
 * 注意: このシリアライザーを使用するにはsuperjsonパッケージが必要です
 * pnpm add superjson
 */

import type { Serializer } from '../types'

/**
 * SuperJSONインターフェース（動的インポート用）
 */
interface SuperJSONModule {
  stringify: (value: unknown) => string
  parse: <T>(str: string) => T
}

let superjsonModule: SuperJSONModule | null = null

/**
 * SuperJSONを動的にロード
 *
 * @returns SuperJSONモジュール
 * @throws superjsonがインストールされていない場合
 */
async function loadSuperJSON(): Promise<SuperJSONModule> {
  if (superjsonModule) {
    return superjsonModule
  }

  try {
    const sjModule = await import('superjson')
    // eslint-disable-next-line require-atomic-updates -- シングルスレッド環境で安全に動作
    superjsonModule = sjModule.default || sjModule
    return superjsonModule
  } catch {
    throw new Error(
      '[redux-storage-middleware] superjson is not installed. ' +
        'Please install it with: pnpm add superjson',
    )
  }
}

/**
 * 同期的にSuperJSONをロード（既にロード済みの場合のみ使用可能）
 */
function getSuperJSON(): SuperJSONModule {
  if (!superjsonModule) {
    throw new Error(
      '[redux-storage-middleware] SuperJSON not loaded. ' +
        'Call initSuperJsonSerializer() first.',
    )
  }
  return superjsonModule
}

/**
 * SuperJSONシリアライザーを初期化
 *
 * アプリケーション起動時に一度呼び出す必要がある
 *
 * @example
 * ```ts
 * await initSuperJsonSerializer()
 * const serializer = createSuperJsonSerializer()
 * ```
 */
export async function initSuperJsonSerializer(): Promise<void> {
  await loadSuperJSON()
}

/**
 * SuperJSONシリアライザーを作成
 *
 * 使用前にinitSuperJsonSerializer()を呼び出す必要がある
 *
 * @returns シリアライザー
 *
 * @example
 * ```ts
 * await initSuperJsonSerializer()
 * const serializer = createSuperJsonSerializer()
 *
 * // Date, Map, Setなどを自動処理
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
        const superjson = getSuperJSON()
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
        const superjson = getSuperJSON()
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
 * SuperJSONがロード済みかどうかを確認
 */
export function isSuperJsonLoaded(): boolean {
  return superjsonModule !== null
}
