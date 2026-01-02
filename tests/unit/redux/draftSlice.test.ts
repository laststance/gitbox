/**
 * Unit Tests: draftSlice Redux Actions
 *
 * Tests for draft notes state management including:
 * - updateDraftNote action
 * - setEditingCardId action
 * - deleteDraftNote action
 * - clearAllDrafts action
 * - All selectors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import draftSlice, {
  updateDraftNote,
  setEditingCardId,
  deleteDraftNote,
  clearAllDrafts,
  selectDraftNotes,
  selectDraftNote,
  selectEditingCardId,
  selectHasDraft,
} from '@/lib/redux/slices/draftSlice'

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
    cardId: string
    content: string
    lastModified: number
  }

  interface DraftState {
    notes: Record<string, DraftNote>
    editingCardId: string | null
  }

  const initialState: DraftState = {
    notes: {},
    editingCardId: null,
  }

  describe('updateDraftNote action', () => {
    it('should create a new draft note for a card', () => {
      const action = updateDraftNote({
        cardId: 'card-123',
        content: 'My draft content',
      })

      const nextState = draftSlice(initialState, action)

      expect(nextState.notes['card-123']).toEqual({
        cardId: 'card-123',
        content: 'My draft content',
        lastModified: mockNow,
      })
    })

    it('should update existing draft note', () => {
      const stateWithDraft = {
        ...initialState,
        notes: {
          'card-123': {
            cardId: 'card-123',
            content: 'Old content',
            lastModified: mockNow - 1000,
          },
        },
      }

      const action = updateDraftNote({
        cardId: 'card-123',
        content: 'Updated content',
      })

      const nextState = draftSlice(stateWithDraft, action)

      expect(nextState.notes['card-123'].content).toBe('Updated content')
      expect(nextState.notes['card-123'].lastModified).toBe(mockNow)
    })

    it('should handle multiple drafts for different cards', () => {
      let state: DraftState = initialState

      state = draftSlice(
        state,
        updateDraftNote({ cardId: 'card-1', content: 'Content 1' }),
      )
      state = draftSlice(
        state,
        updateDraftNote({ cardId: 'card-2', content: 'Content 2' }),
      )
      state = draftSlice(
        state,
        updateDraftNote({ cardId: 'card-3', content: 'Content 3' }),
      )

      expect(Object.keys(state.notes)).toHaveLength(3)
      expect(state.notes['card-1'].content).toBe('Content 1')
      expect(state.notes['card-2'].content).toBe('Content 2')
      expect(state.notes['card-3'].content).toBe('Content 3')
    })

    it('should handle empty content', () => {
      const action = updateDraftNote({
        cardId: 'card-123',
        content: '',
      })

      const nextState = draftSlice(initialState, action)

      expect(nextState.notes['card-123'].content).toBe('')
    })

    it('should handle very long content', () => {
      const longContent = 'x'.repeat(10000)
      const action = updateDraftNote({
        cardId: 'card-123',
        content: longContent,
      })

      const nextState = draftSlice(initialState, action)

      expect(nextState.notes['card-123'].content).toBe(longContent)
    })
  })

  describe('setEditingCardId action', () => {
    it('should set editing card ID', () => {
      const action = setEditingCardId('card-123')

      const nextState = draftSlice(initialState, action)

      expect(nextState.editingCardId).toBe('card-123')
    })

    it('should clear editing card ID with null', () => {
      const stateWithEditing = {
        ...initialState,
        editingCardId: 'card-123',
      }

      const action = setEditingCardId(null)

      const nextState = draftSlice(stateWithEditing, action)

      expect(nextState.editingCardId).toBeNull()
    })

    it('should change from one card to another', () => {
      const stateWithEditing = {
        ...initialState,
        editingCardId: 'card-123',
      }

      const action = setEditingCardId('card-456')

      const nextState = draftSlice(stateWithEditing, action)

      expect(nextState.editingCardId).toBe('card-456')
    })
  })

  describe('deleteDraftNote action', () => {
    it('should delete a draft note', () => {
      const stateWithDraft = {
        ...initialState,
        notes: {
          'card-123': {
            cardId: 'card-123',
            content: 'Some content',
            lastModified: mockNow,
          },
        },
      }

      const action = deleteDraftNote('card-123')

      const nextState = draftSlice(stateWithDraft, action)

      expect(nextState.notes['card-123']).toBeUndefined()
    })

    it('should not affect other drafts', () => {
      const stateWithMultipleDrafts = {
        ...initialState,
        notes: {
          'card-1': {
            cardId: 'card-1',
            content: 'Content 1',
            lastModified: mockNow,
          },
          'card-2': {
            cardId: 'card-2',
            content: 'Content 2',
            lastModified: mockNow,
          },
        },
      }

      const action = deleteDraftNote('card-1')

      const nextState = draftSlice(stateWithMultipleDrafts, action)

      expect(nextState.notes['card-1']).toBeUndefined()
      expect(nextState.notes['card-2']).toBeDefined()
    })

    it('should handle deleting non-existent draft gracefully', () => {
      const action = deleteDraftNote('non-existent')

      const nextState = draftSlice(initialState, action)

      expect(nextState).toEqual(initialState)
    })
  })

  describe('clearAllDrafts action', () => {
    it('should clear all drafts and reset state', () => {
      const stateWithData = {
        notes: {
          'card-1': {
            cardId: 'card-1',
            content: 'Content 1',
            lastModified: mockNow,
          },
          'card-2': {
            cardId: 'card-2',
            content: 'Content 2',
            lastModified: mockNow,
          },
        },
        editingCardId: 'card-1',
      }

      const action = clearAllDrafts()

      const nextState = draftSlice(stateWithData, action)

      expect(nextState.notes).toEqual({})
      expect(nextState.editingCardId).toBeNull()
    })

    it('should handle already empty state', () => {
      const action = clearAllDrafts()

      const nextState = draftSlice(initialState, action)

      expect(nextState).toEqual(initialState)
    })
  })

  describe('Selectors', () => {
    describe('selectDraftNotes', () => {
      it('should return all draft notes', () => {
        const rootState = {
          draft: {
            notes: {
              'card-1': {
                cardId: 'card-1',
                content: 'Content 1',
                lastModified: mockNow,
              },
            },
            editingCardId: null,
          },
        }

        const result = selectDraftNotes(rootState)

        expect(result).toEqual(rootState.draft.notes)
      })

      it('should return empty object when no drafts', () => {
        const rootState = { draft: initialState }

        const result = selectDraftNotes(rootState)

        expect(result).toEqual({})
      })
    })

    describe('selectDraftNote', () => {
      it('should return draft for specific card', () => {
        const draftNote = {
          cardId: 'card-123',
          content: 'Test content',
          lastModified: mockNow,
        }
        const rootState = {
          draft: {
            notes: { 'card-123': draftNote },
            editingCardId: null,
          },
        }

        const selector = selectDraftNote('card-123')
        const result = selector(rootState)

        expect(result).toEqual(draftNote)
      })

      it('should return null for non-existent card', () => {
        const rootState = { draft: initialState }

        const selector = selectDraftNote('non-existent')
        const result = selector(rootState)

        expect(result).toBeNull()
      })
    })

    describe('selectEditingCardId', () => {
      it('should return editing card ID', () => {
        const rootState = {
          draft: {
            notes: {},
            editingCardId: 'card-123',
          },
        }

        const result = selectEditingCardId(rootState)

        expect(result).toBe('card-123')
      })

      it('should return null when not editing', () => {
        const rootState = { draft: initialState }

        const result = selectEditingCardId(rootState)

        expect(result).toBeNull()
      })
    })

    describe('selectHasDraft', () => {
      it('should return true when card has draft', () => {
        const rootState = {
          draft: {
            notes: {
              'card-123': {
                cardId: 'card-123',
                content: 'Content',
                lastModified: mockNow,
              },
            },
            editingCardId: null,
          },
        }

        const selector = selectHasDraft('card-123')
        const result = selector(rootState)

        expect(result).toBe(true)
      })

      it('should return false when card has no draft', () => {
        const rootState = { draft: initialState }

        const selector = selectHasDraft('card-123')
        const result = selector(rootState)

        expect(result).toBe(false)
      })
    })
  })
})
