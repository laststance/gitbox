/**
 * SSR Detection Utility
 *
 * サーバーサイドレンダリング環境を検出するためのユーティリティ関数
 * jotai/zustandのパターンを参考に実装
 */

/**
 * 現在の実行環境がサーバーサイドかどうかを判定
 *
 * @returns サーバーサイドの場合はtrue、ブラウザの場合はfalse
 *
 * @example
 * ```ts
 * if (isServer()) {
 *   // SSR時の処理
 *   return null
 * }
 * // ブラウザでの処理
 * localStorage.getItem('key')
 * ```
 */
export function isServer(): boolean {
  return typeof window === 'undefined'
}

/**
 * 現在の実行環境がブラウザかどうかを判定
 *
 * @returns ブラウザの場合はtrue、サーバーサイドの場合はfalse
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * localStorageが利用可能かどうかを安全にテスト
 *
 * zustandのcreateJSONStorageパターンを参考に、以下をチェック:
 * 1. window が存在するか
 * 2. localStorage が存在するか
 * 3. localStorage に実際にアクセスできるか（プライベートモードなど）
 *
 * @returns localStorageが利用可能な場合はtrue
 *
 * @example
 * ```ts
 * if (!isStorageAvailable()) {
 *   console.warn('localStorage is not available')
 *   return
 * }
 * ```
 */
export function isStorageAvailable(): boolean {
  if (isServer()) {
    return false
  }

  try {
    const testKey = '__redux_storage_middleware_test__'
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    // プライベートモードやクォータ超過など
    return false
  }
}

/**
 * sessionStorageが利用可能かどうかを安全にテスト
 *
 * @returns sessionStorageが利用可能な場合はtrue
 */
export function isSessionStorageAvailable(): boolean {
  if (isServer()) {
    return false
  }

  try {
    const testKey = '__redux_storage_middleware_test__'
    window.sessionStorage.setItem(testKey, testKey)
    window.sessionStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}
