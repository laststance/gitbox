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
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { describe, expect, test, vi } from 'vitest'

import { useNoteModalDraft } from '@/hooks/board/useNoteModalDraft'
import draftReducer from '@/lib/redux/slices/draftSlice'
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
})
