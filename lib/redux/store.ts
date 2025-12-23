/**
 * Redux Toolkit Store Configuration
 *
 * Application-wide state management store
 * - authSlice: Authentication state
 * - boardSlice: Board state
 * - settingsSlice: Settings (theme, language)
 * - storageMiddleware: LocalStorage synchronization
 *
 * Note: GitHub API calls use Server Actions (lib/actions/github.ts) instead of
 * RTK Query for security reasons (HTTP-only cookie token access).
 */

import { configureStore } from '@reduxjs/toolkit'
import type { TypedUseSelectorHook } from 'react-redux'
import { useDispatch, useSelector } from 'react-redux'
// eslint-disable-next-line import/order -- Workspace package resolution differs between local and CI environments
import { createStorageMiddleware } from '@gitbox/redux-storage-middleware'

import authReducer from './slices/authSlice'
import boardReducer from './slices/boardSlice'
import settingsReducer from './slices/settingsSlice'

// Storage middleware configuration
const { middleware: storageMiddleware } = createStorageMiddleware({
  // Synchronize settings and board slices to LocalStorage
  name: 'gitbox-state',
  slices: ['settings', 'board'],
})

export const store = configureStore({
  reducer: {
    auth: authReducer,
    board: boardReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Allow Date objects in Redux state
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
      },
    }).concat(storageMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
})

// TypeScript type definitions
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks (recommended to export in separate file, but simplified here)
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
