/**
 * Unit Tests: useKanbanUndo Hook
 *
 * Pressing Z after a drag must not touch a card that left the board in the
 * meantime. Before this was guarded, undoing a drag after "Move to Another
 * Board" wrote the old board's column onto the moved card: it was then shown
 * on no board, while still holding its repository under the one-card-per-user
 * rule, so the repository could not be added anywhere again.
 *
 * @see src/hooks/board/useKanbanUndo.ts
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useKanbanUndo } from '@/hooks/board/useKanbanUndo'
import { batchUpdateRepoCardOrders } from '@/lib/actions/board'
import type { RepoCardForRedux } from '@/lib/models/domain'
import { setRepoCards } from '@/lib/redux/slices/boardSlice'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

vi.mock('@/lib/actions/board', () => ({
  batchUpdateRepoCardOrders: vi.fn(async () => undefined),
  batchUpdateStatusListPositions: vi.fn(async () => undefined),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

/** A card of board-1 for `laststance/<repoName>` in the given column and position. */
function makeCard(
  id: string,
  repoName: string,
  statusId: string,
  order: number,
): RepoCardForRedux {
  return {
    id: toRepoCardId(id),
    title: `laststance/${repoName}`,
    statusId: toStatusListId(statusId),
    boardId: toBoardId('board-1'),
    repoOwner: 'laststance',
    repoName,
    order,
    meta: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** Press the bare Z key the way a user does outside any input. */
function pressUndoKey(): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }))
  })
}

describe('useKanbanUndo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('undoing a drag leaves a card that was since moved to another board alone', () => {
    // Arrange: snapshot taken before card-1 was dragged from To Do to Done
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ]
    const { result, rerender } = renderHook(
      ({ cards }) => useKanbanUndo({ dispatch, cards }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    // card-1 now sits in Done, and card-2 was moved to another board
    rerender({ cards: [makeCard('card-1', 'gitbox', 'status-done', 0)] })

    // Act
    pressUndoKey()

    // Assert: only card-1 goes back to To Do, on screen and in the database
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      setRepoCards([makeCard('card-1', 'gitbox', 'status-todo', 0)]),
    )
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledTimes(1)
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledWith([
      { id: 'card-1', statusId: 'status-todo', order: 0 },
    ])
  })

  test('undoing a drag keeps a card that was added after the drag, below the restored card', () => {
    // Arrange: snapshot holds only card-1; card-3 was added to To Do after the drag
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [makeCard('card-1', 'gitbox', 'status-todo', 0)]
    const { result, rerender } = renderHook(
      ({ cards }) => useKanbanUndo({ dispatch, cards }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    rerender({
      cards: [
        makeCard('card-1', 'gitbox', 'status-done', 0),
        makeCard('card-3', 'nsx', 'status-todo', 0),
      ],
    })

    // Act
    pressUndoKey()

    // Assert: card-1 is back in To Do; both cards get distinct positions there
    expect(dispatch).toHaveBeenCalledWith(
      setRepoCards([
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-3', 'nsx', 'status-todo', 0),
      ]),
    )
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledWith([
      { id: 'card-1', statusId: 'status-todo', order: 0 },
      { id: 'card-3', statusId: 'status-todo', order: 1 },
    ])
  })

  test('undo saves the order shown on screen even when the cards carry an older order', () => {
    // Arrange: after an earlier drag the screen shows card-2 above card-1,
    // while both cards still carry the order they were loaded with
    const dispatch = vi.fn()
    const snapshotBeforeSecondDrag = [
      makeCard('card-2', 'corelive', 'status-todo', 1),
      makeCard('card-1', 'gitbox', 'status-todo', 0),
    ]
    const { result, rerender } = renderHook(
      ({ cards }) => useKanbanUndo({ dispatch, cards }),
      { initialProps: { cards: snapshotBeforeSecondDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeSecondDrag)
    })
    // The second drag put card-1 back on top
    rerender({
      cards: [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
    })

    // Act
    pressUndoKey()

    // Assert: the database gets card-2 first, exactly as the screen shows it
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledWith([
      { id: 'card-2', statusId: 'status-todo', order: 0 },
      { id: 'card-1', statusId: 'status-todo', order: 1 },
    ])
  })

  test('says there is nothing to undo when the dragged card has left the board', () => {
    // Arrange: card-1 was dragged to Done and then moved to another board
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ]
    const { result, rerender } = renderHook(
      ({ cards }) => useKanbanUndo({ dispatch, cards }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    rerender({ cards: [makeCard('card-2', 'corelive', 'status-todo', 1)] })

    // Act
    pressUndoKey()

    // Assert: no change on screen, no write, and no "undone" claim
    expect(toast.info).toHaveBeenCalledWith('Nothing to undo on this board')
    expect(toast.success).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(batchUpdateRepoCardOrders).not.toHaveBeenCalled()
  })

  test('puts the cards back as they were when the database refuses the undo', async () => {
    // Arrange: the write is refused, e.g. the old column was deleted since
    vi.mocked(batchUpdateRepoCardOrders).mockRejectedValueOnce(
      new Error('Failed to update card orders'),
    )
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [makeCard('card-1', 'gitbox', 'status-todo', 0)]
    const cardsAfterDrag = [makeCard('card-1', 'gitbox', 'status-done', 0)]
    const { result, rerender } = renderHook(
      ({ cards }) => useKanbanUndo({ dispatch, cards }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    rerender({ cards: cardsAfterDrag })

    // Act
    pressUndoKey()

    // Assert: the screen returns to the layout the database still holds
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to sync undo to database',
      )
    })
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      setRepoCards([makeCard('card-1', 'gitbox', 'status-todo', 0)]),
    )
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      setRepoCards([makeCard('card-1', 'gitbox', 'status-done', 0)]),
    )
  })
})
