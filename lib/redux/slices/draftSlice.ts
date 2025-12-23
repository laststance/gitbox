/**
 * Draft Notes Slice
 *
 * Manages draft note content for repo cards before saving to Supabase.
 * Drafts are persisted to LocalStorage via redux-storage-middleware,
 * ensuring users don't lose unsaved work if they close the browser.
 *
 * @example
 * // Save draft while typing
 * dispatch(updateDraftNote({ cardId: 'abc-123', content: 'My note...' }))
 *
 * // Get draft for a card
 * const draft = useAppSelector(selectDraftNote('abc-123'))
 *
 * // Clear draft after successful save
 * dispatch(deleteDraftNote('abc-123'))
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

/**
 * Draft note data for a single repo card
 */
interface DraftNote {
  /** The repo card ID this draft belongs to */
  cardId: string
  /** Draft content (may differ from saved content) */
  content: string
  /** Timestamp of last modification */
  lastModified: number
}

/**
 * Draft slice state
 */
interface DraftState {
  /** Map of cardId -> DraftNote */
  notes: Record<string, DraftNote>
  /** Currently editing card ID (for modal state) */
  editingCardId: string | null
}

const initialState: DraftState = {
  notes: {},
  editingCardId: null,
}

export const draftSlice = createSlice({
  name: 'draft',
  initialState,
  reducers: {
    /**
     * Update or create a draft note for a card
     *
     * @param state - Current state
     * @param action - Payload with cardId and content
     */
    updateDraftNote: (
      state,
      action: PayloadAction<{ cardId: string; content: string }>,
    ) => {
      const { cardId, content } = action.payload
      state.notes[cardId] = {
        cardId,
        content,
        lastModified: Date.now(),
      }
    },

    /**
     * Set the currently editing card ID
     *
     * @param state - Current state
     * @param action - Card ID or null to close
     */
    setEditingCardId: (state, action: PayloadAction<string | null>) => {
      state.editingCardId = action.payload
    },

    /**
     * Delete a draft note (typically after successful save)
     *
     * @param state - Current state
     * @param action - Card ID to delete draft for
     */
    deleteDraftNote: (state, action: PayloadAction<string>) => {
      delete state.notes[action.payload]
    },

    /**
     * Clear all drafts (typically on logout)
     *
     * @returns Initial state
     */
    clearAllDrafts: () => initialState,
  },
})

export const {
  updateDraftNote,
  setEditingCardId,
  deleteDraftNote,
  clearAllDrafts,
} = draftSlice.actions

export default draftSlice.reducer

// ============================================================================
// Selectors
// ============================================================================

type DraftRootState = { draft: DraftState }

/**
 * Select all draft notes
 *
 * @param state - Root state
 * @returns Record of all drafts
 */
export const selectDraftNotes = (state: DraftRootState) => state.draft.notes

/**
 * Select draft note for a specific card
 *
 * @param cardId - The card ID to get draft for
 * @returns Selector function
 * @example
 * const draft = useAppSelector(selectDraftNote('card-123'))
 */
export const selectDraftNote = (cardId: string) => (state: DraftRootState) =>
  state.draft.notes[cardId] ?? null

/**
 * Select currently editing card ID
 *
 * @param state - Root state
 * @returns Card ID or null
 */
export const selectEditingCardId = (state: DraftRootState) =>
  state.draft.editingCardId

/**
 * Check if a card has unsaved draft changes
 *
 * @param cardId - The card ID to check
 * @returns Selector function returning boolean
 */
export const selectHasDraft = (cardId: string) => (state: DraftRootState) =>
  cardId in state.draft.notes
