/**
 * Unit Tests: useNoteModalDraft Hook
 *
 * The note of a card holds 20,000 characters, and from 18,000 on its counter
 * changes color. That color is the one the other counters of the app use
 * near their limit: orange 800 on the light themes and orange 300 on the
 * dark ones. The counter was orange 500, which is between 2.4:1 and 2.9:1 on
 * the dialog of a light theme.
 *
 * @see src/hooks/board/useNoteModalDraft.ts
 * @see src/tests/unit/styles/comment-counter-contrast.test.ts
 */

import { configureStore } from '@reduxjs/toolkit'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useNoteModalDraft } from '@/hooks/board/useNoteModalDraft'
import { ActionUserError } from '@/lib/actions/types'
import draftReducer, { updateDraftNote } from '@/lib/redux/slices/draftSlice'
import { toRepoCardId } from '@/lib/types/brands'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

/**
 * Renders the hook for an open note dialog of a card without a draft.
 * @param noteLength - Number of characters of the note the card has.
 * @returns What the hook gives the dialog.
 * @example
 * renderNoteDraft(18000).charCountClass // the class of the counter near the limit
 */
function renderNoteDraft(
  noteLength: number,
): ReturnType<typeof useNoteModalDraft> {
  const store = configureStore({ reducer: { draft: draftReducer } })
  const { result } = renderHook(
    () =>
      useNoteModalDraft({
        cardId: toRepoCardId('card-1'),
        userId: 'user-1',
        repoKey: 'laststance/gitbox',
        initialNote: 'x'.repeat(noteLength),
        initialLinks: [],
        isOpen: true,
        onSave: vi.fn(),
        onClose: vi.fn(),
        cardTitle: 'laststance/gitbox',
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      ),
    },
  )
  return result.current
}

describe('useNoteModalDraft', () => {
  // Value: protects=the counter of a note close to its limit can be read on the dialog in every theme; fails_when=the counter gets a color that is not the one the contrast test computes, as the orange 500 it had (2.4:1 to 2.9:1 on a light theme); why_new=the hook had no test, and the three other counters of the app were changed without this one; seam=none; no_claim=the contrast of the two colors, which comment-counter-contrast.test.ts computes
  test('colors the counter of a note close to its limit as the other counters of the app', () => {
    // Arrange & Act: 18,000 of 20,000 characters
    const noteDraft = renderNoteDraft(18000)

    // Assert
    expect(noteDraft.charCount).toBe(18000)
    expect(noteDraft.charCountClass).toBe(
      'text-sm text-right text-orange-800 dark:text-orange-300',
    )
  })

  // Value: protects=the orange of the counter is a sign that the limit is near, not its usual color; fails_when=the warning starts below 18,000 characters or the counter is never muted; why_new=the hook had no test; seam=none; no_claim=none
  test('leaves the counter of a shorter note muted', () => {
    // Arrange & Act: one character below the warning
    const noteDraft = renderNoteDraft(17999)

    // Assert
    expect(noteDraft.charCount).toBe(17999)
    expect(noteDraft.charCountClass).toBe(
      'text-sm text-right text-muted-foreground',
    )
  })

  describe('saving', () => {
    beforeEach(() => {
      vi.mocked(toast.success).mockClear()
      vi.mocked(toast.error).mockClear()
    })

    /**
     * Renders the hook for an open note dialog with its own store and save.
     * @param onSave - What saving does (the server action behind it).
     * @returns The hook's result and the store, to read the draft.
     * @example
     * renderNoteDialog(vi.fn().mockResolvedValue(undefined)).store.getState().draft
     */
    function renderNoteDialog(onSave: () => Promise<void>) {
      const store = configureStore({ reducer: { draft: draftReducer } })
      const hook = renderHook(
        () =>
          useNoteModalDraft({
            cardId: toRepoCardId('card-1'),
            userId: 'user-1',
            repoKey: 'laststance/gitbox',
            initialNote: 'old note',
            initialLinks: [],
            isOpen: true,
            onSave,
            onClose: vi.fn(),
            cardTitle: 'laststance/gitbox',
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <Provider store={store}>{children}</Provider>
          ),
        },
      )
      return { ...hook, store }
    }

    // Value: protects=a note the server refused is not lost (issue #216 review, Codex O1); fails_when=handleSave deletes the draft or says "saved" for a refused save again; why_new=no test saved a note through this hook; seam=none; no_claim=the server action's own refusal (mocked onSave)
    test('keeps the typed note as a draft and says the save failed when the server refuses it', async () => {
      // Arrange
      const onSave = vi
        .fn()
        .mockRejectedValue(new Error('Failed to save project information'))
      const { result, store } = renderNoteDialog(onSave)
      act(() => {
        result.current.handleNoteChange('typed before the refusal')
      })

      // Act
      await act(async () => {
        await result.current.handleSave()
      })

      // Assert
      expect(
        store.getState().draft.notes['user-1/laststance/gitbox']?.content,
      ).toBe('typed before the refusal')
      expect(toast.success).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith('Failed to save project info', {
        description:
          'Failed to save project information. Your text is kept: open the note again to save it.',
      })
    })

    // Value: protects=a failed save without a server message still reads as one sentence each, without a doubled full stop (pre-landing review of #216); fails_when=the fallback loses its sentence or gets a second period; why_new=the test above covers a server message without punctuation only; seam=none; no_claim=what a Server Action rejects with in the browser (mocked onSave)
    test('says to try again in one sentence when a failed save carries no message', async () => {
      // Arrange
      const onSave = vi.fn().mockRejectedValue('connection lost')
      const { result } = renderNoteDialog(onSave)
      act(() => {
        result.current.handleNoteChange('typed before the failure')
      })

      // Act
      await act(async () => {
        await result.current.handleSave()
      })

      // Assert
      expect(toast.error).toHaveBeenCalledWith('Failed to save project info', {
        description:
          'Please try again. Your text is kept: open the note again to save it.',
      })
    })

    // Value: protects="saved" is said only for a save the server confirmed; fails_when=the success toast comes before the answer again, or the draft stays after a save; why_new=no test saved a note through this hook; seam=none; no_claim=none beyond protects
    test('says the note was saved only after the server confirmed it, and drops the draft', async () => {
      // Arrange
      const onSave = vi.fn().mockResolvedValue(undefined)
      const { result, store } = renderNoteDialog(onSave)
      act(() => {
        result.current.handleNoteChange('a saved note')
      })

      // Act
      await act(async () => {
        await result.current.handleSave()
      })

      // Assert
      expect(onSave).toHaveBeenCalledWith('a saved note', [])
      expect(
        store.getState().draft.notes['user-1/laststance/gitbox'],
      ).toBeUndefined()
      expect(
        store.getState().draft.notes[toRepoCardId('card-1')],
      ).toBeUndefined()
      expect(toast.success).toHaveBeenCalledWith('Project info saved', {
        description: 'Note and links for laststance/gitbox have been saved.',
      })
    })

    // Value: protects=a save refused because the card is gone does not tell the user to open that card, and the typed text stays under the repository; fails_when=the toast still says "open the note again" or the draft is stored only under the card id; why_new=a new card of the same repository could not see a draft keyed by the old card; seam=none; no_claim=the server deciding the card is gone (mocked onSave)
    test('keeps the typed note under the repository when the card is gone', async () => {
      // Arrange
      const onSave = vi
        .fn()
        .mockRejectedValue(
          new ActionUserError('Card not found', 'CARD_NOT_FOUND'),
        )
      const { result, store } = renderNoteDialog(onSave)
      act(() => {
        result.current.handleNoteChange('typed after the card left')
      })

      // Act
      await act(async () => {
        await result.current.handleSave()
      })

      // Assert
      expect(
        store.getState().draft.notes['user-1/laststance/gitbox']?.content,
      ).toBe('typed after the card left')
      expect(toast.error).toHaveBeenCalledWith('Failed to save project info', {
        description:
          'Your text is kept. Add the repository again and open its note to save it.',
      })
    })

    // Value: protects=adding a repository again shows the note typed against its previous card; fails_when=the dialog reads the draft by card id, so a new card opens empty; why_new=drafts were keyed by the card; seam=none; no_claim=adding the repository (the store is seeded)
    test('opens a draft saved for the repository on a new card of that repository', () => {
      // Arrange
      const store = configureStore({ reducer: { draft: draftReducer } })
      store.dispatch(
        updateDraftNote({
          repoKey: 'user-1/laststance/gitbox',
          content: 'typed on the old card',
          links: [],
        }),
      )
      const { result } = renderHook(
        () =>
          useNoteModalDraft({
            cardId: toRepoCardId('card-2'),
            userId: 'user-1',
            repoKey: 'laststance/gitbox',
            initialNote: '',
            initialLinks: [],
            isOpen: true,
            onSave: vi.fn(),
            onClose: vi.fn(),
            cardTitle: 'laststance/gitbox',
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <Provider store={store}>{children}</Provider>
          ),
        },
      )

      // Act: the dialog initializes from the draft
      // Assert
      expect(result.current.note).toBe('typed on the old card')
    })

    // Value: protects=a second account on the same browser does not see the first account's unsaved note; fails_when=the draft is stored under owner/name alone; why_new=repository keys collide across accounts, while card ids did not; seam=none; no_claim=sign-out clearing localStorage
    test("does not open another account's draft for the same repository", () => {
      // Arrange
      const store = configureStore({ reducer: { draft: draftReducer } })
      store.dispatch(
        updateDraftNote({
          repoKey: 'user-1/laststance/gitbox',
          content: 'the other account typed this',
          links: [],
        }),
      )
      const { result } = renderHook(
        () =>
          useNoteModalDraft({
            cardId: toRepoCardId('card-2'),
            userId: 'user-2',
            repoKey: 'laststance/gitbox',
            initialNote: '',
            initialLinks: [],
            isOpen: true,
            onSave: vi.fn(),
            onClose: vi.fn(),
            cardTitle: 'laststance/gitbox',
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <Provider store={store}>{children}</Provider>
          ),
        },
      )

      // Act: the dialog initializes from this account's draft
      // Assert
      expect(result.current.note).toBe('')
    })

    // Value: protects=an edit made while a save is still in flight is not thrown away when that save succeeds; fails_when=the answer deletes the repository's draft whatever its version; why_new=a successful save used to delete the draft by repository, so a newer edit of the same repository went with it; seam=none; no_claim=the server (mocked onSave)
    test('keeps an edit made while an earlier save is still in flight', async () => {
      // Arrange
      const save = Promise.withResolvers<void>()
      const onSave = vi.fn(async () => save.promise)
      const { result, store } = renderNoteDialog(onSave)
      act(() => {
        result.current.handleNoteChange('the note that was sent')
      })
      await act(async () => {
        void result.current.handleSave()
      })

      // Act: the note is opened again and edited before the server answers
      act(() => {
        result.current.handleNoteChange('typed while the save was in flight')
      })
      await act(async () => {
        save.resolve()
      })

      // Assert
      expect(
        store.getState().draft.notes['user-1/laststance/gitbox']?.content,
      ).toBe('typed while the save was in flight')
    })
  })
})
