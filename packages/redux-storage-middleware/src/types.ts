/**
 * Redux Storage Middleware Type Definitions
 *
 * jotai/zustandのパターンを参考にした包括的な型定義
 */

import type { Middleware } from '@reduxjs/toolkit'

// =============================================================================
// Storage Types
// =============================================================================

/**
 * 同期ストレージインターフェース
 */
export interface SyncStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

/**
 * 非同期ストレージインターフェース
 */
export interface AsyncStorage {
  getItem: (name: string) => Promise<string | null>
  setItem: (name: string, value: string) => Promise<void>
  removeItem: (name: string) => Promise<void>
}

/**
 * ストレージインターフェース（同期・非同期両対応）
 */
export type StateStorage = SyncStorage | AsyncStorage

// =============================================================================
// Serializer Types
// =============================================================================

/**
 * シリアライザーインターフェース
 */
export interface Serializer<T = unknown> {
  /**
   * 状態をJSON文字列に変換
   */
  serialize: (state: T) => string

  /**
   * JSON文字列を状態に復元
   */
  deserialize: (str: string) => T
}

/**
 * JSON Serializerオプション
 */
export interface JsonSerializerOptions {
  /**
   * JSON.stringifyに渡すreplacer関数
   */
  replacer?: (key: string, value: unknown) => unknown

  /**
   * JSON.parseに渡すreviver関数
   */
  reviver?: (key: string, value: unknown) => unknown

  /**
   * インデントスペース数（デバッグ用）
   */
  space?: number
}

// =============================================================================
// Migration Types
// =============================================================================

/**
 * 永続化された状態のラッパー
 */
export interface PersistedState<T = unknown> {
  /**
   * スキーマバージョン
   */
  version: number

  /**
   * 永続化された状態
   */
  state: T
}

/**
 * マイグレーション関数
 */
export type MigrateFn<T = unknown> = (
  persistedState: unknown,
  fromVersion: number,
) => T | Promise<T>

// =============================================================================
// Hydration Types
// =============================================================================

/**
 * ハイドレーション状態
 */
export type HydrationState = 'idle' | 'hydrating' | 'hydrated' | 'error'

/**
 * ハイドレーションAPI
 */
export interface HydrationApi<T = unknown> {
  /**
   * 手動でハイドレーションを開始
   */
  rehydrate: () => Promise<void>

  /**
   * ハイドレーションが完了したかどうか
   */
  hasHydrated: () => boolean

  /**
   * 現在のハイドレーション状態
   */
  getHydrationState: () => HydrationState

  /**
   * ハイドレーションされた状態を取得
   */
  getHydratedState: () => T | null

  /**
   * ストレージをクリア
   */
  clearStorage: () => void

  /**
   * ハイドレーション完了時のコールバックを登録
   */
  onHydrate: (callback: (state: T) => void) => () => void

  /**
   * ハイドレーション完了時のコールバックを登録
   */
  onFinishHydration: (callback: (state: T) => void) => () => void
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * パフォーマンス設定
 */
export interface PerformanceConfig {
  /**
   * デバウンス時間（ミリ秒）
   *
   * @default 300
   */
  debounceMs?: number

  /**
   * スロットル時間（ミリ秒）
   * debounceの代わりに使用する場合
   */
  throttleMs?: number

  /**
   * requestIdleCallbackを使用するか
   *
   * @default false
   */
  useIdleCallback?: boolean

  /**
   * アイドルコールバックのタイムアウト（ミリ秒）
   *
   * @default 1000
   */
  idleTimeout?: number
}

/**
 * ストレージミドルウェアの完全な設定
 */
export interface StorageMiddlewareConfig<S = unknown> {
  /**
   * ストレージキー名
   *
   * @example 'my-app-state'
   */
  name: string

  /**
   * 永続化するスライス名のリスト
   * 指定しない場合は全体を永続化
   *
   * @example ['settings', 'preferences']
   */
  slices?: string[]

  /**
   * 状態の一部のみを永続化するセレクター関数
   * zustandのpartializeパターン
   *
   * @example (state) => ({ user: state.user.profile })
   */
  partialize?: (state: S) => Partial<S>

  /**
   * 永続化から除外するパスのリスト
   *
   * @example ['auth.token', 'temp']
   */
  exclude?: string[]

  // ---------------------------------------------------------------------------
  // Hydration
  // ---------------------------------------------------------------------------

  /**
   * 自動ハイドレーションをスキップするか
   * trueの場合、手動でrehydrate()を呼び出す必要がある
   *
   * @default false
   */
  skipHydration?: boolean

  // ---------------------------------------------------------------------------
  // Version & Migration
  // ---------------------------------------------------------------------------

  /**
   * スキーマバージョン
   * 状態構造が変更された場合に増加させる
   *
   * @default 0
   */
  version?: number

  /**
   * マイグレーション関数
   * 古いバージョンから新しいバージョンへの変換を行う
   */
  migrate?: MigrateFn<S>

  // ---------------------------------------------------------------------------
  // Storage & Serialization
  // ---------------------------------------------------------------------------

  /**
   * カスタムストレージ
   * 指定しない場合はlocalStorageを使用
   */
  storage?: StateStorage

  /**
   * カスタムシリアライザー
   * 指定しない場合はJSON.stringify/parseを使用
   */
  serializer?: Serializer<PersistedState<Partial<S>>>

  // ---------------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------------

  /**
   * パフォーマンス設定
   */
  performance?: PerformanceConfig

  /**
   * デバウンス時間（ミリ秒）
   * 後方互換性のため残存
   *
   * @deprecated performance.debounceMs を使用してください
   * @default 300
   */
  debounceMs?: number

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  /**
   * ハイドレーション開始時のコールバック
   */
  onHydrate?: () => void

  /**
   * ハイドレーション完了時のコールバック
   */
  onHydrationComplete?: (state: S) => void

  /**
   * 保存完了時のコールバック
   */
  onSaveComplete?: (state: S) => void

  /**
   * エラー発生時のコールバック
   */
  onError?: (error: Error, operation: 'load' | 'save' | 'clear') => void

  // ---------------------------------------------------------------------------
  // Merge Strategy
  // ---------------------------------------------------------------------------

  /**
   * ハイドレーション時のマージ関数
   * デフォルトは浅いマージ
   *
   * @param persistedState - 永続化された状態
   * @param currentState - 現在の状態
   * @returns マージされた状態
   */
  merge?: (persistedState: Partial<S>, currentState: S) => S
}

// =============================================================================
// Legacy Types (Backward Compatibility)
// =============================================================================

/**
 * 旧バージョンとの互換性のための設定型
 *
 * @deprecated StorageMiddlewareConfig を使用してください
 */
export interface LegacyStorageMiddlewareConfig {
  slices: string[]
  storageKey: string
  debounceMs?: number
}

// =============================================================================
// Factory Return Types
// =============================================================================

/**
 * createStorageMiddlewareの戻り値
 */
export interface StorageMiddlewareResult<S = unknown> {
  /**
   * Reduxミドルウェア
   */
  middleware: Middleware<object, S>

  /**
   * ハイドレーションAPI
   */
  api: HydrationApi<S>
}

/**
 * ストア拡張インターフェース
 * ミドルウェア適用後のストアに追加されるメソッド
 */
export interface StorageStoreExtension<S = unknown> {
  persist: HydrationApi<S>
}

// =============================================================================
// Action Types
// =============================================================================

/**
 * ハイドレーション開始アクション
 */
export interface HydrateStartAction {
  type: '@@redux-storage-middleware/HYDRATE_START'
}

/**
 * ハイドレーション完了アクション
 */
export interface HydrateCompleteAction<T = unknown> {
  type: '@@redux-storage-middleware/HYDRATE_COMPLETE'
  payload: T
}

/**
 * ハイドレーションエラーアクション
 */
export interface HydrateErrorAction {
  type: '@@redux-storage-middleware/HYDRATE_ERROR'
  payload: Error
}

/**
 * ストレージミドルウェア関連のアクション
 */
export type StorageMiddlewareAction<T = unknown> =
  | HydrateStartAction
  | HydrateCompleteAction<T>
  | HydrateErrorAction

// =============================================================================
// Utility Types
// =============================================================================

/**
 * ネストされたパスを取得するユーティリティ型
 */
export type NestedKeyOf<T extends object> = {
  [K in keyof T & (string | number)]: T[K] extends object
    ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
    : `${K}`
}[keyof T & (string | number)]

/**
 * パスから値の型を取得するユーティリティ型
 */
export type PathValue<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends object
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never
