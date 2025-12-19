/**
 * Redux Toolkit Store Configuration
 *
 * Application-wide state management store
 * - authSlice: Authentication state
 * - boardSlice: Board state
 * - settingsSlice: Settings (theme, language)
 * - storageMiddleware: LocalStorage synchronization
 */

import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import type { TypedUseSelectorHook } from 'react-redux'
import { useDispatch, useSelector } from 'react-redux'

import { githubApi } from '../github/api'

import { createStorageMiddleware } from './middleware/storageMiddleware'
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
    [githubApi.reducerPath]: githubApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore RTK Query actions
        ignoredActions: [githubApi.reducerPath + '/executeQuery/fulfilled'],
        // Allow Date objects in Redux state
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: [githubApi.reducerPath],
      },
    })
      .concat(githubApi.middleware)
      .concat(storageMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
})

// Enable RTK Query's refetchOnFocus/refetchOnReconnect
setupListeners(store.dispatch)

// TypeScript type definitions
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks (recommended to export in separate file, but simplified here)
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
