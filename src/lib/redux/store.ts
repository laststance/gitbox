/**
 * Redux Toolkit Store Configuration
 *
 * Application-wide state management store
 * - boardSlice: Board state (not persisted: the server sends it with every page)
 * - boardSyncSlice: Pending board writes and refreshes (not persisted)
 * - settingsSlice: Settings (theme, language)
 * - storageMiddleware: LocalStorage synchronization
 *
 * Note: GitHub API calls use Server Actions (lib/actions/github.ts) instead of
 * RTK Query for security reasons (HTTP-only cookie token access).
 */
import { createStorageMiddleware } from '@laststance/redux-storage-middleware'
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import type { TypedUseSelectorHook } from 'react-redux'
import { useDispatch, useSelector, useStore } from 'react-redux'

import {
  PERSISTED_SLICE_NAMES,
  PERSISTED_STATE_KEY,
  PERSISTED_STATE_SAVE_DELAY_MS,
  mergePersistedSlices,
} from './persisted-slices'
import boardReducer from './slices/boardSlice'
import boardSyncReducer from './slices/boardSyncSlice'
import draftReducer from './slices/draftSlice'
import settingsReducer from './slices/settingsSlice'

// Combine all reducers
const rootReducer = combineReducers({
  board: boardReducer,
  boardSync: boardSyncReducer,
  draft: draftReducer,
  settings: settingsReducer,
})

// Storage middleware configuration with new API
// Returns hydration-wrapped reducer automatically
const {
  middleware: storageMiddleware,
  reducer: hydratedReducer,
  api: storageApi,
} = createStorageMiddleware({
  rootReducer, // Required: pass root reducer
  key: PERSISTED_STATE_KEY,
  slices: [...PERSISTED_SLICE_NAMES], // Persist these slices to localStorage
  // Sign-out waits this long so the write is in place before the redirect
  performance: { debounceMs: PERSISTED_STATE_SAVE_DELAY_MS },
  // Reads back those slices only: a browser that used the app before still
  // holds a `board` slice, which must not reach the store
  merge: mergePersistedSlices,
})

// Exposed so hooks (e.g. useTheme) can gate effects on localStorage hydration
// completion — avoids transient "initial Redux state" values being applied to
// the DOM in the microtask window before `ACTION_HYDRATE_COMPLETE` fires.
export { storageApi }

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
/**
 * Gives a callback access to the live store. Exists because a callback that
 * resumes after an `await` holds the selector values of the render that
 * created it, and some decisions need the state as it is now. Called by
 * {@link useBoardRollback} and {@link useBoardServerSync}. Components keep using {@link useAppSelector} for
 * anything they render: `getState()` does not subscribe.
 *
 * @returns The Redux store of the surrounding provider.
 * @example
 * const store = useAppStore()
 * const onSaveFailed = () => {
 *   store.getState().board.repoCards // => the cards on screen right now
 * }
 */
export const useAppStore = () => useStore<RootState>()
