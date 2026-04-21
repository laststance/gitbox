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
import type { CardIdentifier } from '@/lib/types/brands'

/**
 * In-progress note content for a single card (board repo *or* maintenance).
 *
 * @example
 * { cardId: 'c1' as RepoCardId, content: 'WIP…', links: [], lastModified: 1700000000000 }
 */
interface DraftNote {
  /** The {@link CardIdentifier} this draft belongs to. */
  cardId: CardIdentifier
  /** Draft content (may differ from what's saved in Supabase). */
  content: string
  /** Draft external links (may differ from saved links). */
  links: ProjectLink[]
  /** `Date.now()` timestamp (ms since epoch) of the last edit. */
  lastModified: number
}

/** Shape of the `state.draft` Redux slice. */
interface DraftState {
  /** Keyed lookup of drafts by {@link CardIdentifier}. */
  notes: Record<CardIdentifier, DraftNote>
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
        cardId: CardIdentifier
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
     * @param action - {@link CardIdentifier} to delete draft for
     */
    deleteDraftNote: (state, action: PayloadAction<CardIdentifier>) => {
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
 * @param cardId - The {@link CardIdentifier} to get draft for
 * @returns Selector function
 * @example
 * const draft = useAppSelector(selectDraftNote(card.id))
 */
export const selectDraftNote =
  (cardId: CardIdentifier) => (state: DraftRootState) =>
    state.draft.notes[cardId] ?? null
