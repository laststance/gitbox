/**
 * Unit Tests: draftSlice Redux Actions
 *
 * Tests for draft notes state management including:
 * - updateDraftNote action
 * - deleteDraftNote action
 * - selectDraftNote selector
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

import draftSlice, {
  updateDraftNote,
  deleteDraftNote,
  selectDraftNote,
} from '@/lib/redux/slices/draftSlice'
import { toRepoCardId } from '@/lib/types/brands'

describe('draftSlice', () => {
  // Mock Date.now for consistent timestamps
  const mockNow = 1704067200000 // 2024-01-01 00:00:00 UTC

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(mockNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Type for draft slice state (matches the slice's internal state).
  // The keys in these tests are repository keys, stored as plain strings.
  interface DraftNote {
    repoKey: string
    content: string
    links: { url: string; type: string }[]
    lastModified: number
  }

  interface DraftState {
    notes: Record<string, DraftNote>
  }

  const initialState: DraftState = {
    notes: {},
  }

  describe('updateDraftNote action', () => {
    test('should create a new draft note for a card', () => {
      const action = updateDraftNote({
        repoKey: toRepoCardId('card-123'),
        content: 'My draft content',
        links: [],
      })

      const nextState = draftSlice(initialState, action)

      expect(nextState.notes[toRepoCardId('card-123')]).toEqual({
        repoKey: toRepoCardId('card-123'),
        content: 'My draft content',
        links: [],
        lastModified: mockNow,
      })
    })

    test('should update existing draft note', () => {
      const stateWithDraft = {
        ...initialState,
        notes: {
          [toRepoCardId('card-123')]: {
            repoKey: toRepoCardId('card-123'),
            content: 'Old content',
            links: [],
            lastModified: mockNow - 1000,
          },
        },
      }

      const action = updateDraftNote({
        repoKey: toRepoCardId('card-123'),
        content: 'Updated content',
        links: [{ url: 'https://example.com', type: 'vercel' }],
      })

      const nextState = draftSlice(stateWithDraft, action)

      expect(nextState.notes[toRepoCardId('card-123')]!.content).toBe(
        'Updated content',
      )
      expect(nextState.notes[toRepoCardId('card-123')]!.links).toEqual([
        { url: 'https://example.com', type: 'vercel' },
      ])
      expect(nextState.notes[toRepoCardId('card-123')]!.lastModified).toBe(
        mockNow,
      )
    })

    test('should handle multiple drafts for different cards', () => {
      let state: DraftState = initialState

      state = draftSlice(
        state,
        updateDraftNote({
          repoKey: toRepoCardId('card-1'),
          content: 'Content 1',
          links: [],
        }),
      )
      state = draftSlice(
        state,
        updateDraftNote({
          repoKey: toRepoCardId('card-2'),
          content: 'Content 2',
          links: [],
        }),
      )
      state = draftSlice(
        state,
        updateDraftNote({
          repoKey: toRepoCardId('card-3'),
          content: 'Content 3',
          links: [],
        }),
      )

      expect(Object.keys(state.notes)).toHaveLength(3)
      expect(state.notes[toRepoCardId('card-1')]!.content).toBe('Content 1')
      expect(state.notes[toRepoCardId('card-2')]!.content).toBe('Content 2')
      expect(state.notes[toRepoCardId('card-3')]!.content).toBe('Content 3')
    })

    test('should handle empty content', () => {
      const action = updateDraftNote({
        repoKey: toRepoCardId('card-123'),
        content: '',
        links: [],
      })

      const nextState = draftSlice(initialState, action)

      expect(nextState.notes[toRepoCardId('card-123')]!.content).toBe('')
    })

    test('should handle very long content', () => {
      const longContent = 'x'.repeat(10000)
      const action = updateDraftNote({
        repoKey: toRepoCardId('card-123'),
        content: longContent,
        links: [],
      })

      const nextState = draftSlice(initialState, action)

      expect(nextState.notes[toRepoCardId('card-123')]!.content).toBe(
        longContent,
      )
    })
  })

  describe('deleteDraftNote action', () => {
    test('should delete a draft note', () => {
      const stateWithDraft = {
        ...initialState,
        notes: {
          [toRepoCardId('card-123')]: {
            repoKey: toRepoCardId('card-123'),
            content: 'Some content',
            links: [],
            lastModified: mockNow,
          },
        },
      }

      const action = deleteDraftNote({ repoKey: toRepoCardId('card-123') })

      const nextState = draftSlice(stateWithDraft, action)

      expect(nextState.notes[toRepoCardId('card-123')]).toBeUndefined()
    })

    test('should not affect other drafts', () => {
      const stateWithMultipleDrafts = {
        ...initialState,
        notes: {
          [toRepoCardId('card-1')]: {
            repoKey: toRepoCardId('card-1'),
            content: 'Content 1',
            links: [],
            lastModified: mockNow,
          },
          [toRepoCardId('card-2')]: {
            repoKey: toRepoCardId('card-2'),
            content: 'Content 2',
            links: [],
            lastModified: mockNow,
          },
        },
      }

      const action = deleteDraftNote({ repoKey: toRepoCardId('card-1') })

      const nextState = draftSlice(stateWithMultipleDrafts, action)

      expect(nextState.notes[toRepoCardId('card-1')]).toBeUndefined()
      expect(nextState.notes[toRepoCardId('card-2')]).toBeDefined()
    })

    test('leaves a newer draft in place when an earlier save finishes', () => {
      const stateWithDraft = {
        ...initialState,
        notes: {
          'user-1/laststance/gitbox': {
            repoKey: 'user-1/laststance/gitbox',
            content: 'typed while the save was in flight',
            links: [],
            lastModified: mockNow + 1,
          },
        },
      }

      const nextState = draftSlice(
        stateWithDraft,
        deleteDraftNote({
          repoKey: 'user-1/laststance/gitbox',
          savedVersion: mockNow,
        }),
      )

      expect(nextState.notes['user-1/laststance/gitbox']?.content).toBe(
        'typed while the save was in flight',
      )
    })

    test('should handle deleting non-existent draft gracefully', () => {
      const action = deleteDraftNote({ repoKey: toRepoCardId('non-existent') })

      const nextState = draftSlice(initialState, action)

      expect(nextState).toEqual(initialState)
    })
  })

  describe('Selectors', () => {
    describe('selectDraftNote', () => {
      test('should return draft for specific card', () => {
        const draftNote = {
          repoKey: toRepoCardId('card-123'),
          content: 'Test content',
          links: [],
          lastModified: mockNow,
        }
        const rootState = {
          draft: {
            notes: { [toRepoCardId('card-123')]: draftNote },
          },
        }

        const selector = selectDraftNote(toRepoCardId('card-123'))
        const result = selector(rootState)

        expect(result).toEqual(draftNote)
      })

      test('returns a draft an older version stored under the card id', () => {
        const draftNote = {
          repoKey: toRepoCardId('card-123'),
          content: 'Typed on the old card',
          links: [],
          lastModified: mockNow,
        }
        const rootState = {
          draft: {
            notes: { [toRepoCardId('card-123')]: draftNote },
          },
        }

        const result = selectDraftNote(
          'laststance/gitbox',
          toRepoCardId('card-123'),
        )(rootState)

        expect(result).toEqual(draftNote)
      })

      test('should return null for non-existent card', () => {
        const rootState = { draft: initialState }

        const selector = selectDraftNote(toRepoCardId('non-existent'))
        const result = selector(rootState)

        expect(result).toBeNull()
      })
    })
  })
})
