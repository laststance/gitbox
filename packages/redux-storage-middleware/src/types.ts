/**
 * Type definitions for Redux Storage Middleware
 */

export interface StorageMiddlewareConfig {
  /**
   * Redux state のスライス名のリスト
   * これらのスライスのみが LocalStorage に保存される
   *
   * @example ['settings', 'preferences', 'theme']
   */
  slices: string[]

  /**
   * LocalStorage のキー名
   *
   * @default 'redux-state'
   */
  storageKey: string

  /**
   * デバウンス時間（ミリ秒）
   * state の変更後、この時間が経過してから保存される
   *
   * @default 300
   */
  debounceMs?: number
}
