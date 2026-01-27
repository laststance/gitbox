/**
 * Draft Notes Slice
 *
 * Manages draft note content and links for repo cards before saving to Supabase.
 * Drafts are persisted to LocalStorage via redux-storage-middleware,
 * ensuring users don't lose unsaved work if they close the browser.
 *
 * @example
 * // Save draft while typing
 * dispatch(updateDraftNote({ cardId: 'abc-123', content: 'My note...', links: [] }))
 *
 * // Get draft for a card
 * const draft = useAppSelector(selectDraftNote('abc-123'))
 *
 * // Clear draft after successful save
 * dispatch(deleteDraftNote('abc-123'))
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type { ProjectLink } from '@/lib/actions/project-info'

/**
 * Draft note data for a single repo card
 */
interface DraftNote {
  /** The repo card ID this draft belongs to */
  cardId: string
  /** Draft content (may differ from saved content) */
  content: string
  /** Draft links (may differ from saved links) */
  links: ProjectLink[]
  /** Timestamp of last modification */
  lastModified: number
}

/**
 * Draft slice state
 */
interface DraftState {
  /** Map of cardId -> DraftNote */
  notes: Record<string, DraftNote>
}

const initialState: DraftState = {
  notes: {},
}

export const draftSlice = createSlice({
  name: 'draft',
  initialState,
  reducers: {
    /**
     * Update or create a draft note for a card
     *
     * @param state - Current state
     * @param action - Payload with cardId, content, and optional links
     */
    updateDraftNote: (
      state,
      action: PayloadAction<{
        cardId: string
        content: string
        links?: ProjectLink[]
      }>,
    ) => {
      const { cardId, content, links } = action.payload
      // Preserve existing links if not provided (backward compatible)
      const existingLinks = state.notes[cardId]?.links ?? []
      state.notes[cardId] = {
        cardId,
        content,
        links: links ?? existingLinks,
        lastModified: Date.now(),
      }
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
  },
})

export const { updateDraftNote, deleteDraftNote } = draftSlice.actions

export default draftSlice.reducer

// ============================================================================
// Selectors
// ============================================================================

type DraftRootState = { draft: DraftState }

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
 * Select draft links for a specific card
 *
 * @param cardId - The card ID to get draft links for
 * @returns Selector function returning links array or empty array
 * @example
 * const links = useAppSelector(selectDraftLinks('card-123'))
 */
export const selectDraftLinks =
  (cardId: string) =>
  (state: DraftRootState): ProjectLink[] =>
    state.draft.notes[cardId]?.links ?? []
