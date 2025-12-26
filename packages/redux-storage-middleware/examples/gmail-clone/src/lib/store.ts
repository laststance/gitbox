/**
 * Redux Store with redux-storage-middleware
 *
 * Gmail Clone demonstration of localStorage persistence
 */

import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { createStorageMiddleware } from '@gitbox/redux-storage-middleware'

import emailReducer, { type EmailsState } from './features/emails/emailSlice'

/**
 * Define state shape explicitly to avoid circular type reference
 */
interface AppState {
  emails: EmailsState
}

// Create root reducer
const rootReducer = combineReducers({
  emails: emailReducer,
})

// Create storage middleware with new API (rootReducer is now required)
const {
  middleware: storageMiddleware,
  reducer: hydratedReducer,
  api: storageApi,
} = createStorageMiddleware<AppState>({
  rootReducer, // Required: pass root reducer
  name: 'gmail-clone-state',
  slices: ['emails'],
  performance: {
    debounceMs: 300, // Debounce writes for performance
    useIdleCallback: false, // Disabled for E2E test predictability
  },
  onHydrationComplete: (state: AppState) => {
    console.log('[Gmail Clone] Hydrated from localStorage:', {
      emailCount: state.emails?.emails?.length ?? 0,
    })
  },
  onSaveComplete: (state: AppState) => {
    console.log('[Gmail Clone] Saved to localStorage:', {
      emailCount: state.emails?.emails?.length ?? 0,
    })
  },
  onError: (error: Error, operation: string) => {
    console.error(`[Gmail Clone] Storage ${operation} error:`, error)
  },
})

export const store = configureStore({
  reducer: hydratedReducer, // Use returned reducer (already hydration-wrapped)
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
      },
    }).concat(storageMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
})

// Export storage API for manual control
export { storageApi }

// TypeScript types
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
