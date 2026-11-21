/**
 * Unit Tests: leaving an account drops what it left in this browser
 *
 * Sign-out and account deletion empty the unsaved notes, the remembered
 * move destinations and the per-repository note editor visibility. The
 * theme stays, and localStorage is written before the server action
 * redirects.
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
  setNoteEditorOpen,
  setTheme,
} from '@/lib/redux/slices/settingsSlice'

describe('forgetAccountOnThisBrowser', () => {
  test('drops the unsaved note, the last move and the note editor visibility, and keeps the theme in localStorage', async () => {
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
    store.dispatch(
      setNoteEditorOpen({ repoKey: 'laststance/gitbox', open: false }),
    )

    // Act
    await forgetAccountOnThisBrowser(store)

    // Assert
    expect(store.getState().draft.notes).toEqual({})
    expect(store.getState().settings.theme).toBe('rust')
    expect(store.getState().settings.moveDestinationByBoard).toEqual({})
    expect(store.getState().settings.noteEditorOpenByRepo).toEqual({})
    const stored = JSON.parse(localStorage.getItem('gitbox-state') ?? '{}') as {
      state: {
        draft: { notes: Record<string, unknown> }
        settings: {
          theme: string
          moveDestinationByBoard: Record<string, string>
          noteEditorOpenByRepo: Record<string, boolean>
        }
      }
    }
    expect(stored.state.draft.notes).toEqual({})
    expect(stored.state.settings.theme).toBe('rust')
    expect(stored.state.settings.moveDestinationByBoard).toEqual({})
    expect(stored.state.settings.noteEditorOpenByRepo).toEqual({})
  })
})
