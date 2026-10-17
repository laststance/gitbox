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
  interface CommentProps {
    initialComments: Record<string, CommentData>
    fetchedComments: Record<string, CommentData> | null
  }

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

  // Value: protects=a comment changed in another tab shows up after a refetch, and an edit on this tab stays when that read still has the previous text (TODOS.md board settings refetch); fails_when=the hook keeps every comment from the first paint, or a stale read puts the previous text back; why_new=a refetch did not reach this hook; seam=none; no_claim=the fetch itself (useBoardServerSync.test.tsx)
  test('shows a comment changed in another tab and keeps a comment edited here when the fetch still has its previous text', async () => {
    // Arrange
    const firstComments: Record<string, CommentData> = {
      'card-1': { comment: 'from the page', color: 'primary' },
      'card-2': { comment: 'also from the page', color: 'primary' },
    }
    const initialProps: CommentProps = {
      initialComments: firstComments,
      fetchedComments: null,
    }
    const { result, rerender } = renderHook(
      (props: CommentProps) => useCommentState(props),
      { initialProps },
    )
    await act(async () => {
      await result.current.handleCommentChange('card-1', 'edited here')
    })

    // Act
    rerender({
      initialComments: firstComments,
      fetchedComments: {
        'card-1': { comment: 'from the page', color: 'primary' },
        'card-2': { comment: 'changed elsewhere', color: 'blue' },
        'card-3': { comment: 'added elsewhere', color: 'green' },
      },
    })

    // Assert
    expect(result.current.comments).toEqual({
      'card-1': { comment: 'edited here', color: 'primary' },
      'card-2': { comment: 'changed elsewhere', color: 'blue' },
      'card-3': { comment: 'added elsewhere', color: 'green' },
    })
  })

  // Value: protects=a comment removed in another tab leaves the card, while an edit on this tab stays when that read no longer has the card; fails_when=a removed comment stays, or an edit is dropped with the card; why_new=the refetch can omit a card; seam=none; no_claim=deleting the card
  test('drops a comment the fetch no longer has and keeps one edited here', async () => {
    // Arrange
    const firstComments: Record<string, CommentData> = {
      'card-1': { comment: 'from the page', color: 'primary' },
      'card-2': { comment: 'also from the page', color: 'primary' },
    }
    const initialProps: CommentProps = {
      initialComments: firstComments,
      fetchedComments: null,
    }
    const { result, rerender } = renderHook(
      (props: CommentProps) => useCommentState(props),
      { initialProps },
    )
    await act(async () => {
      await result.current.handleCommentChange('card-1', 'edited here')
    })

    // Act: the other tab's board no longer has either card
    rerender({
      initialComments: firstComments,
      fetchedComments: {},
    })

    // Assert
    expect(result.current.comments).toEqual({
      'card-1': { comment: 'edited here', color: 'primary' },
    })
  })
})
