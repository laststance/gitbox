/**
 * Draft Notes Slice
 *
 * Manages draft note content and links before saving to Supabase.
 * A draft belongs to the repository, the same key as `projectinfo.repo_key`,
 * so a card that is removed and added again still has the typed text.
 * Drafts are persisted to LocalStorage via redux-storage-middleware.
 *
 * A draft saved by an older version is keyed by the card id. {@link selectDraftNote}
 * still reads that key, and the next edit moves it under the repository.
 *
 * @example
 * dispatch(updateDraftNote({ repoKey: 'laststance/gitbox', content: 'My note...', links: [] }))
 * const draft = useAppSelector(selectDraftNote('laststance/gitbox', card.id))
 * dispatch(deleteDraftNote({ repoKey: 'laststance/gitbox', legacyCardId: card.id }))
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type { ProjectLink } from '@/lib/actions/project-info'
import type { RepoCardId } from '@/lib/types/brands'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'

/**
 * In-progress note content for one repository.
 *
 * @example
 * { repoKey: 'laststance/gitbox', content: 'WIP…', links: [], lastModified: 1700000000000 }
 */
interface DraftNote {
  /** Lowercase `owner/name`, the key of `projectinfo.repo_key`. */
  repoKey: RepoIdentifier
  /** Draft content (may differ from what's saved in Supabase). */
  content: string
  /** Draft external links (may differ from saved links). */
  links: ProjectLink[]
  /** `Date.now()` timestamp (ms since epoch) of the last edit. */
  lastModified: number
}

/** Shape of the `state.draft` Redux slice. */
interface DraftState {
  /**
   * Drafts by repository key. An entry left by an older version is keyed by
   * the card id instead, and is read only as a fallback.
   */
  notes: Record<string, DraftNote>
}

const initialState: DraftState = {
  notes: {},
}

/**
 * Storage key of one account's draft for one repository.
 *
 * The `draft` slice is one localStorage entry shared by every account that
 * uses the browser. A key of only `owner/name` would show the previous
 * account's unsaved note when the next account opens the same repository.
 * Called by {@link useNoteModalDraft}.
 *
 * @param userId - The signed-in account (`board.user_id`).
 * @param repoKey - Lowercase `owner/name`.
 * @returns The key the slice stores the draft under.
 * @example
 * noteDraftKey('user-1', 'laststance/gitbox') // => 'user-1/laststance/gitbox'
 */
export function noteDraftKey(userId: string, repoKey: RepoIdentifier): string {
  return `${userId}/${repoKey}`
}

export const draftSlice = createSlice({
  name: 'draft',
  initialState,
  reducers: {
    /**
     * Update or create the draft of a repository.
     *
     * Called while the Note dialog is edited. A draft an older version stored
     * under the card id is dropped here, so the repository's key is the only
     * copy from then on.
     *
     * @param state - Current state
     * @param action - The repository key, the note, and the links
     */
    updateDraftNote: (
      state,
      action: PayloadAction<{
        repoKey: RepoIdentifier
        content: string
        links?: ProjectLink[]
        legacyCardId?: RepoCardId
      }>,
    ) => {
      const { repoKey, content, links, legacyCardId } = action.payload
      const previous =
        state.notes[repoKey] ??
        (legacyCardId ? state.notes[legacyCardId] : undefined)
      state.notes[repoKey] = {
        repoKey,
        content,
        links: links ?? previous?.links ?? [],
        // A later edit in the same millisecond still has to differ, or a save
        // that started on the previous version would delete it.
        lastModified: Math.max(Date.now(), (previous?.lastModified ?? 0) + 1),
      }
      // The card-id copy would hide a later edit if the selector preferred it
      if (legacyCardId && legacyCardId !== repoKey) {
        delete state.notes[legacyCardId]
      }
    },

    /**
     * Delete the draft of a repository after the server has saved it.
     *
     * Also drops the card-id copy an older version may still hold, so a
     * confirmed save does not come back the next time the note opens.
     *
     * @param state - Current state
     * @param action - The repository key, and the card id when one is open
     */
    deleteDraftNote: (
      state,
      action: PayloadAction<{
        repoKey: string
        legacyCardId?: RepoCardId
        /**
         * The `lastModified` of the draft Save sent. Only a draft that still
         * has this value is removed. `null` means Save had no draft, so a
         * draft written while the save was in flight stays. Omitted removes
         * the keys outright.
         */
        savedVersion?: number | null
      }>,
    ) => {
      const { repoKey, legacyCardId, savedVersion } = action.payload
      // A draft that appeared after Save was pressed is a newer edit.
      if (savedVersion === null) return
      const drop = (key: string | undefined): void => {
        if (!key) return
        if (
          savedVersion === undefined ||
          state.notes[key]?.lastModified === savedVersion
        ) {
          delete state.notes[key]
        }
      }
      drop(repoKey)
      drop(legacyCardId)
    },
  },
})

export const { updateDraftNote, deleteDraftNote } = draftSlice.actions

export default draftSlice.reducer

type DraftRootState = { draft: DraftState }

/**
 * Select the draft of a repository, or the draft an older version stored
 * under the card id when the repository has none yet.
 *
 * Called by {@link useNoteModalDraft} when the Note dialog opens. The card
 * id is only the fallback: a repository added again has a new card id, and
 * the text typed against the old card is under the repository key.
 *
 * @param repoKey - The storage key from {@link noteDraftKey}.
 * @param legacyCardId - The card that is open, for a draft saved before the key changed.
 * @returns The draft, or `null` when neither key has one.
 * @example
 * const draft = useAppSelector(selectDraftNote('laststance/gitbox', card.id))
 */
export const selectDraftNote =
  (repoKey: RepoIdentifier, legacyCardId?: RepoCardId) =>
  (state: DraftRootState): DraftNote | null =>
    state.draft.notes[repoKey] ??
    (legacyCardId ? state.draft.notes[legacyCardId] : undefined) ??
    null
