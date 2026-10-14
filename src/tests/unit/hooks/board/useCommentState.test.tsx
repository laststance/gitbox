/**
 * Unit Tests: useCommentState adopts the comments of cards added later
 *
 * The board reads its comments once per page load. A repository added again
 * brings its comment back (issue #216): the board page passes it in with the
 * comments it already had, and the hook takes the cards it has not seen yet
 * without undoing what the user did to the others.
 *
 * @see src/hooks/board/useCommentState.ts
 */

import { renderHook, act } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { useCommentState } from '@/hooks/board/useCommentState'
import type { CommentData } from '@/lib/actions/project-info'
import { updateComment } from '@/lib/actions/project-info'

vi.mock('@/lib/actions/project-info', () => ({
  updateComment: vi.fn(async () => ({ success: true })),
  updateCommentColor: vi.fn(async () => ({ success: true })),
  deleteComment: vi.fn(async () => ({ success: true })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('useCommentState', () => {
  // Value: protects=a card added again shows its kept comment without a reload, and an edit made on another card is not undone by it (eng review R1); fails_when=the hook keeps its first state only, or replaces local edits with the prop; why_new=the hook had no test; seam=none; no_claim=the server answer of the add (repo-cards.placement.test.ts, repository-memory.spec.ts)
  test('shows the comment of a card added later and keeps the comment the user just edited', async () => {
    // Arrange
    const firstComments: Record<string, CommentData> = {
      'card-1': { comment: 'from the page', color: 'primary' },
    }
    const { result, rerender } = renderHook(
      ({ initialComments }) => useCommentState({ initialComments }),
      { initialProps: { initialComments: firstComments } },
    )
    await act(async () => {
      await result.current.handleCommentChange('card-1', 'edited here')
    })

    // Act: the board page adds the comment the re-added repository kept
    rerender({
      initialComments: {
        ...firstComments,
        'card-2': { comment: 'v2.0リリース準備中', color: 'blue' },
      },
    })

    // Assert
    expect(vi.mocked(updateComment)).toHaveBeenCalledWith(
      'card-1',
      'edited here',
    )
    expect(result.current.comments).toEqual({
      'card-1': { comment: 'edited here', color: 'primary' },
      'card-2': { comment: 'v2.0リリース準備中', color: 'blue' },
    })
  })
})
