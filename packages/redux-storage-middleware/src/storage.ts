/**
 * Storage Abstraction Layer
 *
 * localStorageへの安全なアクセスを提供するストレージレイヤー
 * SSR環境でのクラッシュを防止し、カスタムストレージバックエンドをサポート
 */

import type { StateStorage, SyncStorage, AsyncStorage } from './types'
import { isStorageAvailable, isSessionStorageAvailable } from './utils/isServer'

/**
 * SSR-safeなlocalStorageラッパーを作成
 *
 * zustandのcreateJSONStorageパターンを参考に実装
 * サーバーサイドやストレージ未対応環境ではnoopストレージを返す
 *
 * @returns SSR-safeなStorageオブジェクト
 *
 * @example
 * ```ts
 * const storage = createSafeLocalStorage()
 * storage.setItem('key', 'value') // SSR時は何もしない
 * ```
 */
export function createSafeLocalStorage(): SyncStorage {
  if (!isStorageAvailable()) {
    // SSR環境またはストレージ未対応 - noopストレージを返す
    return createNoopStorage()
  }

  return {
    getItem: (name: string): string | null => {
      try {
        return window.localStorage.getItem(name)
      } catch {
        console.warn(
          `[redux-storage-middleware] Failed to read from localStorage: ${name}`,
        )
        return null
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        window.localStorage.setItem(name, value)
      } catch (error) {
        console.warn(
          `[redux-storage-middleware] Failed to write to localStorage: ${name}`,
          error,
        )
      }
    },
    removeItem: (name: string): void => {
      try {
        window.localStorage.removeItem(name)
      } catch {
        console.warn(
          `[redux-storage-middleware] Failed to remove from localStorage: ${name}`,
        )
      }
    },
  }
}

/**
 * SSR-safeなsessionStorageラッパーを作成
 *
 * @returns SSR-safeなStorageオブジェクト
 */
export function createSafeSessionStorage(): SyncStorage {
  if (!isSessionStorageAvailable()) {
    return createNoopStorage()
  }

  return {
    getItem: (name: string): string | null => {
      try {
        return window.sessionStorage.getItem(name)
      } catch {
        console.warn(
          `[redux-storage-middleware] Failed to read from sessionStorage: ${name}`,
        )
        return null
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        window.sessionStorage.setItem(name, value)
      } catch (error) {
        console.warn(
          `[redux-storage-middleware] Failed to write to sessionStorage: ${name}`,
          error,
        )
      }
    },
    removeItem: (name: string): void => {
      try {
        window.sessionStorage.removeItem(name)
      } catch {
        console.warn(
          `[redux-storage-middleware] Failed to remove from sessionStorage: ${name}`,
        )
      }
    },
  }
}

/**
 * 何もしないnoopストレージを作成
 *
 * SSR環境やストレージ未対応環境で使用
 *
 * @returns noopストレージオブジェクト
 */
export function createNoopStorage(): SyncStorage {
  return {
    getItem: (): null => null,
    setItem: (): void => {},
    removeItem: (): void => {},
  }
}

/**
 * インメモリストレージを作成
 *
 * テストやSSRフォールバック用のインメモリストレージ
 *
 * @returns インメモリストレージオブジェクト
 */
export function createMemoryStorage(): SyncStorage {
  const store = new Map<string, string>()

  return {
    getItem: (name: string): string | null => store.get(name) ?? null,
    setItem: (name: string, value: string): void => {
      store.set(name, value)
    },
    removeItem: (name: string): void => {
      store.delete(name)
    },
  }
}

/**
 * 同期ストレージを非同期ストレージに変換
 *
 * @param storage - 同期ストレージ
 * @returns 非同期ストレージ
 */
export function toAsyncStorage(storage: SyncStorage): AsyncStorage {
  return {
    getItem: async (name: string): Promise<string | null> =>
      storage.getItem(name),
    setItem: async (name: string, value: string): Promise<void> =>
      storage.setItem(name, value),
    removeItem: async (name: string): Promise<void> => storage.removeItem(name),
  }
}

/**
 * StateStorageを検証
 *
 * @param storage - 検証対象のストレージ
 * @returns 有効なストレージの場合はtrue
 */
export function isValidStorage(storage: unknown): storage is StateStorage {
  if (storage === null || storage === undefined) {
    return false
  }

  if (typeof storage !== 'object') {
    return false
  }

  const s = storage as Record<string, unknown>
  return (
    typeof s.getItem === 'function' &&
    typeof s.setItem === 'function' &&
    typeof s.removeItem === 'function'
  )
}

/**
 * ストレージのサイズを取得（概算）
 *
 * @param storage - ストレージ
 * @param key - キー
 * @returns バイト数
 */
export function getStorageSize(storage: SyncStorage, key: string): number {
  const value = storage.getItem(key)
  if (value === null) {
    return 0
  }
  // UTF-16エンコーディングを考慮（JavaScriptの文字列は2バイト/文字）
  return key.length * 2 + value.length * 2
}

/**
 * localStorageの残り容量を取得（概算）
 *
 * @returns 残りバイト数（取得できない場合は-1）
 */
export function getRemainingStorageQuota(): number {
  if (!isStorageAvailable()) {
    return -1
  }

  try {
    // 5MBを超えるテストデータで残り容量を推定
    const testKey = '__quota_test__'
    let testData = 'a'
    let maxSize = 0

    // 段階的に増やして限界を探る（最大5MB程度）
    for (let i = 0; i < 22; i++) {
      try {
        window.localStorage.setItem(testKey, testData)
        maxSize = testData.length
        testData = testData + testData // 2倍に増やす
      } catch {
        break
      }
    }

    window.localStorage.removeItem(testKey)

    // 概算として現在使用量を差し引く
    let currentUsage = 0
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key) {
        const value = window.localStorage.getItem(key)
        if (value) {
          currentUsage += key.length + value.length
        }
      }
    }

    // UTF-16を考慮
    return (maxSize - currentUsage) * 2
  } catch {
    return -1
  }
}
