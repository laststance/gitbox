/**
 * Redux Toolkit Store Configuration
 *
 * アプリケーション全体の状態管理ストア
 * - authSlice: 認証状態
 * - boardSlice: ボード状態
 * - settingsSlice: 設定（テーマ、言語）
 * - storageMiddleware: LocalStorage 同期
 */

import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import authReducer from './slices/authSlice'
import boardReducer from './slices/boardSlice'
import settingsReducer from './slices/settingsSlice'
import { githubApi } from '../github/api'
import { createStorageMiddleware } from './middleware/storageMiddleware'

// Storage middleware の設定
const storageMiddleware = createStorageMiddleware({
  // settings スライスのみ LocalStorage に同期
  slices: ['settings'],
  storageKey: 'vibe-rush-state',
})

export const store = configureStore({
  reducer: {
    auth: authReducer,
    board: boardReducer,
    settings: settingsReducer,
    [githubApi.reducerPath]: githubApi.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // RTK Query の action を無視
        ignoredActions: [githubApi.reducerPath + '/executeQuery/fulfilled'],
        // Redux state の Date オブジェクトを許可
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: [githubApi.reducerPath],
      },
    })
      .concat(githubApi.middleware)
      .concat(storageMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
})

// RTK Query の refetchOnFocus/refetchOnReconnect を有効化
setupListeners(store.dispatch)

// TypeScript 型定義
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks (別ファイルで export 推奨だが、ここでは簡潔に)
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
