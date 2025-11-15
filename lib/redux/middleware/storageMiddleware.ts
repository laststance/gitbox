/**
 * Storage Middleware Configuration
 *
 * カスタム redux-storage-middleware パッケージのインスタンス化
 */

import { createStorageMiddleware } from '@vibe-rush/redux-storage-middleware'

/**
 * LocalStorage 同期ミドルウェア
 *
 * settings スライスのみを LocalStorage に保存
 * テーマ、言語、タイポグラフィ設定などを永続化
 */
export { createStorageMiddleware }
