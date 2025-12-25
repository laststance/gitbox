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

/* eslint-disable import/order -- Workspace package @gitbox/* resolves differently in CI vs local environments */
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import type { TypedUseSelectorHook } from 'react-redux'
import { useDispatch, useSelector } from 'react-redux'

import { createStorageMiddleware } from '@gitbox/redux-storage-middleware'
import authReducer from './slices/authSlice'
import boardReducer from './slices/boardSlice'
import draftReducer from './slices/draftSlice'
import settingsReducer from './slices/settingsSlice'

// Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  board: boardReducer,
  draft: draftReducer,
  settings: settingsReducer,
})

// Storage middleware configuration with new API
// Returns hydration-wrapped reducer automatically
const { middleware: storageMiddleware, reducer: hydratedReducer } =
  createStorageMiddleware({
    rootReducer, // Required: pass root reducer
    name: 'gitbox-state',
    slices: ['settings', 'board', 'draft'], // Persist these slices to localStorage
  })

export const store = configureStore({
  // Use returned reducer (already hydration-wrapped)
  reducer: hydratedReducer,
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
