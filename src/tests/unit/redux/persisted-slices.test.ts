/**
 * Unit Test: what localStorage puts back into the store
 *
 * The board is not persisted any more. A browser that used the app before
 * still holds one, and it must not come back: with it in the store, React
 * hydrated a board page against markup the server had rendered without
 * columns and threw that markup away (error #418).
 */

import { describe, expect, test } from 'vitest'

import {
  PERSISTED_SLICE_NAMES,
  mergePersistedSlices,
} from '@/lib/redux/persisted-slices'

/** A state with the three slices of the app, small enough to read at a glance. */
interface StateUnderTest {
  settings: { theme: string }
  draft: { notes: Record<string, string> }
  board: { statusLists: { id: string }[]; repoCards: { id: string }[] }
}

/**
 * The state of a store that has read nothing from localStorage yet.
 * @returns A fresh copy, so no test sees what another one changed.
 */
function createUntouchedState(): StateUnderTest {
  return {
    settings: { theme: 'system' },
    draft: { notes: {} },
    board: { statusLists: [], repoCards: [] },
  }
}

describe('mergePersistedSlices', () => {
  test('leaves the board of an earlier version in localStorage and keeps the empty board of the store', () => {
    // Arrange: a browser that used the app before the board stopped being stored
    const persistedState: Partial<StateUnderTest> = {
      settings: { theme: 'rust' },
      draft: { notes: { 'card-1': 'half a sentence' } },
      board: { statusLists: [{ id: 'old-column' }], repoCards: [] },
    }
    const currentState = createUntouchedState()

    // Act
    const mergedState = mergePersistedSlices(persistedState, currentState)

    // Assert
    expect(mergedState.board).toEqual({ statusLists: [], repoCards: [] })
  })

  test('reads the chosen theme and an unsaved note back', () => {
    // Arrange
    const persistedState: Partial<StateUnderTest> = {
      settings: { theme: 'rust' },
      draft: { notes: { 'card-1': 'half a sentence' } },
    }
    const currentState = createUntouchedState()

    // Act
    const mergedState = mergePersistedSlices(persistedState, currentState)

    // Assert
    expect(mergedState.settings).toEqual({ theme: 'rust' })
    expect(mergedState.draft).toEqual({
      notes: { 'card-1': 'half a sentence' },
    })
  })

  test('keeps the settings of the store when localStorage holds drafts only', () => {
    // Arrange
    const persistedState: Partial<StateUnderTest> = {
      draft: { notes: { 'card-1': 'half a sentence' } },
    }
    const currentState = createUntouchedState()

    // Act
    const mergedState = mergePersistedSlices(persistedState, currentState)

    // Assert
    expect(mergedState.settings).toEqual({ theme: 'system' })
  })

  test('persists the settings and the drafts, and not the board', () => {
    // Arrange / Act / Assert
    expect(PERSISTED_SLICE_NAMES).toEqual(['settings', 'draft'])
  })
})
