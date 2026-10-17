/**
 * Unit Tests: leaving an account drops what it left in this browser
 *
 * Sign-out and account deletion empty the unsaved notes and the remembered
 * move destinations. The theme stays, and localStorage is written before the
 * server action redirects.
 */

import { createStorageMiddleware } from '@laststance/redux-storage-middleware'
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { describe, expect, test } from 'vitest'

import { forgetAccountOnThisBrowser } from '@/lib/redux/forget-account-on-this-browser'
import {
  PERSISTED_STATE_SAVE_DELAY_MS,
  mergePersistedSlices,
} from '@/lib/redux/persisted-slices'
import draftReducer, { updateDraftNote } from '@/lib/redux/slices/draftSlice'
import settingsReducer, {
  setMoveDestination,
  setTheme,
} from '@/lib/redux/slices/settingsSlice'

describe('forgetAccountOnThisBrowser', () => {
  test('drops the unsaved note and the last move, and keeps the theme in localStorage', async () => {
    // Arrange: the middleware writes only after it has read localStorage
    localStorage.clear()
    const rootReducer = combineReducers({
      draft: draftReducer,
      settings: settingsReducer,
    })
    const { middleware, reducer, api } = createStorageMiddleware({
      rootReducer,
      key: 'gitbox-state',
      slices: ['settings', 'draft'],
      merge: mergePersistedSlices,
      performance: { debounceMs: PERSISTED_STATE_SAVE_DELAY_MS },
    })
    const store = configureStore({
      reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(middleware),
    })
    await api.rehydrate()
    store.dispatch(
      updateDraftNote({
        repoKey: 'user-1/laststance/gitbox',
        content: 'a sentence not saved yet',
        links: [],
      }),
    )
    store.dispatch(setTheme('rust'))
    store.dispatch(
      setMoveDestination({
        sourceBoardId: 'board-work',
        destinationBoardId: 'board-archive',
      }),
    )

    // Act
    await forgetAccountOnThisBrowser(store)

    // Assert
    expect(store.getState().draft.notes).toEqual({})
    expect(store.getState().settings.theme).toBe('rust')
    expect(store.getState().settings.moveDestinationByBoard).toEqual({})
    const stored = JSON.parse(localStorage.getItem('gitbox-state') ?? '{}') as {
      state: {
        draft: { notes: Record<string, unknown> }
        settings: {
          theme: string
          moveDestinationByBoard: Record<string, string>
        }
      }
    }
    expect(stored.state.draft.notes).toEqual({})
    expect(stored.state.settings.theme).toBe('rust')
    expect(stored.state.settings.moveDestinationByBoard).toEqual({})
  })
})
