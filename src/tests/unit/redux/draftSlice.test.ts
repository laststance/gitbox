/**
 * Unit Tests: draftSlice Redux Actions
 *
 * Tests for draft notes state management including:
 * - updateDraftNote action
 * - deleteDraftNote action
 * - selectDraftNote selector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import draftSlice, {
  updateDraftNote,
  deleteDraftNote,
  selectDraftNote,
} from '@/lib/redux/slices/draftSlice'
import { toRepoCardId, type RepoCardId } from '@/lib/types/brands'

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

  // Type for draft slice state (matches the slice's internal state)
  interface DraftNote {
    cardId: RepoCardId
    content: string
    links: { url: string; type: string }[]
    lastModified: number
  }

  interface DraftState {
    notes: Record<RepoCardId, DraftNote>
  }

  const initialState: DraftState = {
    notes: {},
  }

  describe('updateDraftNote action', () => {
    it('should create a new draft note for a card', () => {
      const action = updateDraftNote({
        cardId: toRepoCardId('card-123'),
        content: 'My draft content',
        links: [],
      })

      const nextState = draftSlice(initialState, action)

      expect(nextState.notes[toRepoCardId('card-123')]).toEqual({
        cardId: toRepoCardId('card-123'),
        content: 'My draft content',
        links: [],
        lastModified: mockNow,
      })
    })

    it('should update existing draft note', () => {
      const stateWithDraft = {
        ...initialState,
        notes: {
          [toRepoCardId('card-123')]: {
            cardId: toRepoCardId('card-123'),
            content: 'Old content',
            links: [],
            lastModified: mockNow - 1000,
          },
        },
      }

      const action = updateDraftNote({
        cardId: toRepoCardId('card-123'),
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

    it('should handle multiple drafts for different cards', () => {
      let state: DraftState = initialState

      state = draftSlice(
        state,
        updateDraftNote({
          cardId: toRepoCardId('card-1'),
          content: 'Content 1',
          links: [],
        }),
      )
      state = draftSlice(
        state,
        updateDraftNote({
          cardId: toRepoCardId('card-2'),
          content: 'Content 2',
          links: [],
        }),
      )
      state = draftSlice(
        state,
        updateDraftNote({
          cardId: toRepoCardId('card-3'),
          content: 'Content 3',
          links: [],
        }),
      )

      expect(Object.keys(state.notes)).toHaveLength(3)
      expect(state.notes[toRepoCardId('card-1')]!.content).toBe('Content 1')
      expect(state.notes[toRepoCardId('card-2')]!.content).toBe('Content 2')
      expect(state.notes[toRepoCardId('card-3')]!.content).toBe('Content 3')
    })

    it('should handle empty content', () => {
      const action = updateDraftNote({
        cardId: toRepoCardId('card-123'),
        content: '',
        links: [],
      })

      const nextState = draftSlice(initialState, action)

      expect(nextState.notes[toRepoCardId('card-123')]!.content).toBe('')
    })

    it('should handle very long content', () => {
      const longContent = 'x'.repeat(10000)
      const action = updateDraftNote({
        cardId: toRepoCardId('card-123'),
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
    it('should delete a draft note', () => {
      const stateWithDraft = {
        ...initialState,
        notes: {
          [toRepoCardId('card-123')]: {
            cardId: toRepoCardId('card-123'),
            content: 'Some content',
            links: [],
            lastModified: mockNow,
          },
        },
      }

      const action = deleteDraftNote(toRepoCardId('card-123'))

      const nextState = draftSlice(stateWithDraft, action)

      expect(nextState.notes[toRepoCardId('card-123')]).toBeUndefined()
    })

    it('should not affect other drafts', () => {
      const stateWithMultipleDrafts = {
        ...initialState,
        notes: {
          [toRepoCardId('card-1')]: {
            cardId: toRepoCardId('card-1'),
            content: 'Content 1',
            links: [],
            lastModified: mockNow,
          },
          [toRepoCardId('card-2')]: {
            cardId: toRepoCardId('card-2'),
            content: 'Content 2',
            links: [],
            lastModified: mockNow,
          },
        },
      }

      const action = deleteDraftNote(toRepoCardId('card-1'))

      const nextState = draftSlice(stateWithMultipleDrafts, action)

      expect(nextState.notes[toRepoCardId('card-1')]).toBeUndefined()
      expect(nextState.notes[toRepoCardId('card-2')]).toBeDefined()
    })

    it('should handle deleting non-existent draft gracefully', () => {
      const action = deleteDraftNote(toRepoCardId('non-existent'))

      const nextState = draftSlice(initialState, action)

      expect(nextState).toEqual(initialState)
    })
  })

  describe('Selectors', () => {
    describe('selectDraftNote', () => {
      it('should return draft for specific card', () => {
        const draftNote = {
          cardId: toRepoCardId('card-123'),
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

      it('should return null for non-existent card', () => {
        const rootState = { draft: initialState }

        const selector = selectDraftNote(toRepoCardId('non-existent'))
        const result = selector(rootState)

        expect(result).toBeNull()
      })
    })
  })
})
