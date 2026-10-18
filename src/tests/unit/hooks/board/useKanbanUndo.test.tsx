/**
 * Unit Tests: useKanbanUndo Hook
 *
 * Pressing Z after a drag must not touch a card that left the board in the
 * meantime. Before this was guarded, undoing a drag after "Move to Another
 * Board" wrote the old board's column onto the moved card: it was then shown
 * on no board, while still holding its repository under the one-card-per-user
 * rule, so the repository could not be added anywhere again.
 *
 * Z is a shortcut of the board. While a dialog, a menu or a list of options
 * lies on top of the board, the key belongs to that layer: a Radix Select
 * reads a typed letter as "jump to the option that starts with it" and lets
 * the key travel on to the window. The sidebar that lies over the page below
 * 768px is such a layer too: the page behind it is inert. So are the layers
 * the app builds by hand, the command palette and the Add Repositories
 * panel: they carry `data-overlay`.
 *
 * @see src/hooks/board/useKanbanUndo.ts
 */

import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useKanbanUndo } from '@/hooks/board/useKanbanUndo'
import {
  batchUpdateRepoCardOrders,
  batchUpdateStatusListPositions,
} from '@/lib/actions/board'
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import { setRepoCards, setStatusLists } from '@/lib/redux/slices/boardSlice'
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

/** A column of board-1 at the given grid position. */
function makeColumn(
  id: string,
  title: string,
  gridRow: number,
  gridCol: number,
  color = '#6B7280',
): StatusListDomain {
  return {
    id: toStatusListId(id),
    title,
    color,
    gridRow,
    gridCol,
    boardId: toBoardId('board-1'),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** Columns the card-only undo tests leave on the board. */
const CARD_COLUMNS = [
  makeColumn('status-todo', 'To Do', 0, 0),
  makeColumn('status-done', 'Done', 0, 1),
]

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

  // Value: protects=Z after a column drag, with every column still on the board, puts those columns back and shows Column order restored; fails_when=the columns stay at the dragged positions or the toast is missing; why_new=the column walk only skips a snapshot that names a missing column; seam=none; no_claim=a deleted column
  test('undoing a column drag puts columns that are all still here back where they were', () => {
    // Arrange: snapshot taken before Building was dragged to the left
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 1),
    ]
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushColumnHistory(snapshotBeforeDrag)
    })
    rerender({
      statuses: [
        makeColumn('col-b', 'Building', 0, 0),
        makeColumn('col-a', 'Ideas', 0, 1),
      ],
    })

    // Act
    pressUndoKey()

    // Assert
    expect(dispatch).toHaveBeenCalledWith(
      setStatusLists([
        makeColumn('col-a', 'Ideas', 0, 0),
        makeColumn('col-b', 'Building', 0, 1),
      ]),
    )
    expect(batchUpdateStatusListPositions).toHaveBeenCalledWith([
      { id: 'col-a', gridRow: 0, gridCol: 0 },
      { id: 'col-b', gridRow: 0, gridCol: 1 },
    ])
    expect(toast.success).toHaveBeenCalledWith('Column order restored', {
      id: 'board-undo',
    })
  })

  // Value: protects=Z skips a column snapshot that names a deleted column, so the columns that remain stay put and Column order restored is not shown; fails_when=the survivors move to the snapshot's positions or that toast appears; why_new=reconcileColumnUndo used to drop the missing id and still move the rest; seam=none; no_claim=the database function
  test('undoing a column drag does nothing when the snapshot names a deleted column', () => {
    // Arrange: snapshot of three columns, then Shipped is deleted
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 1),
      makeColumn('col-c', 'Shipped', 0, 2),
    ]
    const columnsNow = [
      makeColumn('col-a', 'Ideas', 0, 1),
      makeColumn('col-b', 'Building', 0, 0),
    ]
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushColumnHistory(snapshotBeforeDrag)
    })
    rerender({ statuses: columnsNow })

    // Act
    pressUndoKey()

    // Assert
    expect(dispatch).not.toHaveBeenCalledWith(setStatusLists(columnsNow))
    expect(dispatch).not.toHaveBeenCalledWith(
      setStatusLists([
        makeColumn('col-a', 'Ideas', 0, 0),
        makeColumn('col-b', 'Building', 0, 1),
      ]),
    )
    expect(batchUpdateStatusListPositions).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalledWith('Column order restored', {
      id: 'board-undo',
    })
    expect(toast.info).toHaveBeenCalledWith('Nothing to undo on this board')
  })

  // Value: protects=one Z applies the older column snapshot when the newer one names a deleted column, and shows Column order restored once; fails_when=applying the newer snapshot writes Ideas at (0, 2); why_new=the older grid used to be what reconcileColumnUndo would produce from the newer snapshot, so applying the unfit one still passed; seam=none; no_claim=the database function
  test('undoing walks past a column snapshot that names a deleted column and restores the older one', () => {
    // Arrange: older is Ideas at (0, 0) and Building at (1, 0). The newer
    // snapshot is Ideas (0, 2), Building (0, 1), Shipped (0, 0). Putting that
    // newer snapshot through reconcileColumnUndo would write Ideas at (0, 2).
    const dispatch = vi.fn()
    const olderSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 1, 0),
    ]
    const newerSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 2),
      makeColumn('col-b', 'Building', 0, 1),
      makeColumn('col-c', 'Shipped', 0, 0),
    ]
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: olderSnapshot } },
    )
    act(() => {
      result.current.pushColumnHistory(olderSnapshot)
      result.current.pushColumnHistory(newerSnapshot)
    })
    rerender({
      statuses: [
        makeColumn('col-a', 'Ideas', 0, 1),
        makeColumn('col-b', 'Building', 0, 0),
      ],
    })

    // Act
    pressUndoKey()

    // Assert: the older positions, once. Ideas at (0, 2) is the unfit snapshot.
    expect(batchUpdateStatusListPositions).toHaveBeenCalledTimes(1)
    expect(batchUpdateStatusListPositions).toHaveBeenCalledWith([
      { id: 'col-a', gridRow: 0, gridCol: 0 },
      { id: 'col-b', gridRow: 1, gridCol: 0 },
    ])
    expect(batchUpdateStatusListPositions).not.toHaveBeenCalledWith([
      { id: 'col-a', gridRow: 0, gridCol: 2 },
      { id: 'col-b', gridRow: 0, gridCol: 1 },
    ])
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Column order restored', {
      id: 'board-undo',
    })
  })

  // Value: protects=Z skips an older column snapshot that would put a survivor on the cell of a column added since, so the columns stay put and no positions are written; fails_when=Building is written to (0, 1) on top of Review, or Column order restored is shown; why_new=skipping a snapshot that names a deleted column used to apply the older one and stack the survivor on the added column; seam=none; no_claim=the database unique index, which does not exist
  test('undoing skips a column snapshot that would stack two columns on one cell', () => {
    // Arrange: the newer snapshot names Shipped, which is gone. The older
    // one would put Building back on (0, 1), where Review sits now.
    const dispatch = vi.fn()
    const olderSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 1),
    ]
    const newerSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 1, 0),
      makeColumn('col-c', 'Shipped', 0, 2),
      makeColumn('col-d', 'Review', 0, 1),
    ]
    const columnsNow = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 1, 0),
      makeColumn('col-d', 'Review', 0, 1),
    ]
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: olderSnapshot } },
    )
    act(() => {
      result.current.pushColumnHistory(olderSnapshot)
      result.current.pushColumnHistory(newerSnapshot)
    })
    rerender({ statuses: columnsNow })

    // Act
    pressUndoKey()

    // Assert: Building is not written onto Review's cell
    expect(batchUpdateStatusListPositions).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalledWith(
      setStatusLists([
        makeColumn('col-a', 'Ideas', 0, 0),
        makeColumn('col-b', 'Building', 0, 1),
        makeColumn('col-d', 'Review', 0, 1),
      ]),
    )
    expect(toast.success).not.toHaveBeenCalledWith('Column order restored', {
      id: 'board-undo',
    })
    expect(toast.info).toHaveBeenCalledWith('Nothing to undo on this board')
  })

  // Value: protects=one Z skips a newer column snapshot that would stack two columns and restores the older layout that does not; fails_when=Building is written to (0, 2) on top of Review, or the older layout is not written; why_new=the stack guard was only tested when the stacking snapshot was the last one on the stack; seam=none; no_claim=the database unique index, which does not exist
  test('undoing walks past a column snapshot that would stack two columns and restores the older one', () => {
    // Arrange: the newer snapshot would put Building on Review's cell.
    // The older one puts Building on its own row.
    const dispatch = vi.fn()
    const olderSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 1, 0),
    ]
    const newerSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 2),
    ]
    const columnsNow = [
      makeColumn('col-a', 'Ideas', 0, 1),
      makeColumn('col-b', 'Building', 0, 0),
      makeColumn('col-d', 'Review', 0, 2),
    ]
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: olderSnapshot } },
    )
    act(() => {
      result.current.pushColumnHistory(olderSnapshot)
      result.current.pushColumnHistory(newerSnapshot)
    })
    rerender({ statuses: columnsNow })

    // Act
    pressUndoKey()

    // Assert: the older layout, with Review left on (0, 2)
    expect(batchUpdateStatusListPositions).toHaveBeenCalledTimes(1)
    expect(batchUpdateStatusListPositions).toHaveBeenCalledWith([
      { id: 'col-a', gridRow: 0, gridCol: 0 },
      { id: 'col-b', gridRow: 1, gridCol: 0 },
      { id: 'col-d', gridRow: 0, gridCol: 2 },
    ])
    expect(toast.success).toHaveBeenCalledWith('Column order restored', {
      id: 'board-undo',
    })
  })

  // Value: protects=one Z undoes a card when the only column snapshot names a deleted column, and does not move the columns; fails_when=the columns move, or the card stays where the drag left it; why_new=a column entry used to consume the key even when it named a missing column; seam=none; no_claim=the database function
  test('undoing a card drag still runs when the column snapshot names a deleted column', () => {
    // Arrange
    const dispatch = vi.fn()
    const columnSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-c', 'Shipped', 0, 1),
    ]
    const columnsNow = [makeColumn('col-a', 'Ideas', 0, 1)]
    // The board numbers a card from its place in the array, not its `order` field.
    const cardSnapshot = [
      makeCard('card-1', 'gitbox', 'col-a', 0),
      makeCard('card-2', 'corelive', 'col-a', 1),
    ]
    const cardsNow = [
      makeCard('card-2', 'corelive', 'col-a', 0),
      makeCard('card-1', 'gitbox', 'col-a', 1),
    ]
    const { result, rerender } = renderHook(
      ({ statuses, cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: columnSnapshot, cards: cardSnapshot } },
    )
    act(() => {
      result.current.pushColumnHistory(columnSnapshot)
      result.current.pushCardHistory(cardSnapshot)
    })
    rerender({ statuses: columnsNow, cards: cardsNow })

    // Act
    pressUndoKey()

    // Assert
    expect(dispatch).not.toHaveBeenCalledWith(setStatusLists(columnsNow))
    expect(batchUpdateStatusListPositions).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalledWith('Column order restored', {
      id: 'board-undo',
    })
    expect(dispatch).toHaveBeenCalledWith(setRepoCards(cardSnapshot))
    expect(toast.success).toHaveBeenCalledWith('Card operation undone', {
      id: 'board-undo',
    })
  })

  // Value: protects=Z does not send a card back to a column that was deleted, after the column snapshots were skipped; fails_when=setRepoCards puts the card in the deleted column, or batchUpdateRepoCardOrders is called with that column; why_new=the same Z now tries the card stack, and that write used to throw and pull the card off the board until rollback; seam=none; no_claim=the database foreign key
  test('undoing does not send a card back to a column that was deleted', () => {
    // Arrange: the only column snapshot names Shipped, which is gone. The
    // card snapshot still has the card in that column.
    const dispatch = vi.fn()
    const columnSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-c', 'Shipped', 0, 1),
    ]
    const columnsNow = [makeColumn('col-a', 'Ideas', 0, 1)]
    const cardSnapshot = [makeCard('card-1', 'gitbox', 'col-c', 0)]
    const cardsNow = [makeCard('card-1', 'gitbox', 'col-a', 0)]
    const { result, rerender } = renderHook(
      ({ statuses, cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: columnSnapshot, cards: cardSnapshot } },
    )
    act(() => {
      result.current.pushColumnHistory(columnSnapshot)
      result.current.pushCardHistory(cardSnapshot)
    })
    rerender({ statuses: columnsNow, cards: cardsNow })

    // Act
    pressUndoKey()

    // Assert: the card stays in Ideas, and the deleted column is not written
    expect(batchUpdateRepoCardOrders).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalledWith(setRepoCards(cardSnapshot))
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('Nothing to undo on this board')
  })

  // Value: protects=one Z still undoes a card that moved between living columns when the same snapshot would also send another card to a deleted column; fails_when=no card write runs, or the write names the deleted column; why_new=the guard used to drop the whole snapshot, so the other card's move was lost; seam=none; no_claim=the database foreign key
  test('undoing keeps a card out of a deleted column and still restores the other card', () => {
    // Arrange: gitbox was in Shipped, which is gone, and now sits in Ideas.
    // corelive was in Ideas and was dragged to Building.
    const dispatch = vi.fn()
    const columnsNow = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 1),
    ]
    const cardSnapshot = [
      makeCard('card-1', 'gitbox', 'col-c', 0),
      makeCard('card-2', 'corelive', 'col-a', 0),
    ]
    const cardsNow = [
      makeCard('card-1', 'gitbox', 'col-a', 0),
      makeCard('card-2', 'corelive', 'col-b', 0),
    ]
    const { result, rerender } = renderHook(
      ({ statuses, cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: columnsNow, cards: cardSnapshot } },
    )
    act(() => {
      result.current.pushCardHistory(cardSnapshot)
    })
    rerender({ statuses: columnsNow, cards: cardsNow })

    // Act
    pressUndoKey()

    // Assert: corelive goes back to Ideas. gitbox stays in Ideas. Shipped is not written.
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledTimes(1)
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledWith([
      { id: 'card-1', statusId: 'col-a', order: 0 },
      { id: 'card-2', statusId: 'col-a', order: 1 },
    ])
    expect(toast.success).toHaveBeenCalledWith('Card operation undone', {
      id: 'board-undo',
    })
  })

  // Value: protects=a card that would return to a deleted column keeps its current place while the other cards return in snapshot order; fails_when=the stayed card is written at the snapshot's slot, so the column order becomes B, C, A; why_new=replacing the card object left it in the snapshot slot and the write saved that order; seam=none; no_claim=the database foreign key
  test('undoing leaves a card in its current place when its old column is gone', () => {
    // Arrange: the snapshot is B, C, then A in Shipped. A is now first in Ideas.
    const dispatch = vi.fn()
    const columnsNow = [makeColumn('col-a', 'Ideas', 0, 0)]
    const cardSnapshot = [
      makeCard('card-b', 'corelive', 'col-a', 0),
      makeCard('card-c', 'gitbox', 'col-a', 1),
      makeCard('card-a', 'laststance', 'col-c', 0),
    ]
    const cardsNow = [
      makeCard('card-a', 'laststance', 'col-a', 0),
      makeCard('card-c', 'gitbox', 'col-a', 1),
      makeCard('card-b', 'corelive', 'col-a', 2),
    ]
    const { result, rerender } = renderHook(
      ({ statuses, cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: columnsNow, cards: cardSnapshot } },
    )
    act(() => {
      result.current.pushCardHistory(cardSnapshot)
    })
    rerender({ statuses: columnsNow, cards: cardsNow })

    // Act
    pressUndoKey()

    // Assert: A stays first. B then C follow, which is the snapshot order.
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledWith([
      { id: 'card-a', statusId: 'col-a', order: 0 },
      { id: 'card-b', statusId: 'col-a', order: 1 },
      { id: 'card-c', statusId: 'col-a', order: 2 },
    ])
  })

  // Value: protects=a card that stays in its column keeps its place there when another column's card sits between it and the top in the board array; fails_when=the stayed card is written above the card that was already above it; why_new=pinning the board-array index let a card from another column take the slot and the write swapped the column; seam=none; no_claim=another tab
  test('undoing does not move a card inside its column when its old column is gone', () => {
    // Arrange: Ideas shows Alpha then Pinned. Building holds Beta. Pinned's
    // snapshot column is gone, and Alpha and Beta are already where the
    // snapshot puts them.
    const dispatch = vi.fn()
    const columnsNow = [
      makeColumn('col-x', 'Ideas', 0, 0),
      makeColumn('col-y', 'Building', 0, 1),
    ]
    const cardSnapshot = [
      makeCard('card-b', 'beta', 'col-y', 0),
      makeCard('card-a', 'alpha', 'col-x', 0),
      makeCard('card-p', 'pinned', 'col-gone', 0),
    ]
    const cardsNow = [
      makeCard('card-a', 'alpha', 'col-x', 0),
      makeCard('card-p', 'pinned', 'col-x', 1),
      makeCard('card-b', 'beta', 'col-y', 0),
    ]
    const { result, rerender } = renderHook(
      ({ statuses, cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: columnsNow, cards: cardSnapshot } },
    )
    act(() => {
      result.current.pushCardHistory(cardSnapshot)
    })
    rerender({ statuses: columnsNow, cards: cardsNow })

    // Act
    pressUndoKey()

    // Assert: nothing moves, so nothing is written
    expect(batchUpdateRepoCardOrders).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('Nothing to undo on this board')
  })

  // Value: protects=two cards that stay in a column keep their order when the other cards leave that column; fails_when=the later card is written above the earlier one; why_new=both old indexes fell past the shorter column and the later card took the first free slot; seam=none; no_claim=another tab
  test('undoing keeps the order of cards that stay when their column gets shorter', () => {
    // Arrange: Ideas is Alpha, Beta, Stay, Tail. The snapshot sends Alpha
    // and Beta to Building. Stay and Tail were in a column that is gone.
    const dispatch = vi.fn()
    const columnsNow = [
      makeColumn('col-x', 'Ideas', 0, 0),
      makeColumn('col-y', 'Building', 0, 1),
    ]
    const cardSnapshot = [
      makeCard('card-a', 'alpha', 'col-y', 0),
      makeCard('card-b', 'beta', 'col-y', 1),
      makeCard('card-s', 'stay', 'col-gone', 0),
      makeCard('card-t', 'tail', 'col-gone', 1),
    ]
    const cardsNow = [
      makeCard('card-a', 'alpha', 'col-x', 0),
      makeCard('card-b', 'beta', 'col-x', 1),
      makeCard('card-s', 'stay', 'col-x', 2),
      makeCard('card-t', 'tail', 'col-x', 3),
    ]
    const { result, rerender } = renderHook(
      ({ statuses, cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: columnsNow, cards: cardSnapshot } },
    )
    act(() => {
      result.current.pushCardHistory(cardSnapshot)
    })
    rerender({ statuses: columnsNow, cards: cardsNow })

    // Act
    pressUndoKey()

    // Assert: Stay stays above Tail. Alpha and Beta go to Building.
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledWith([
      { id: 'card-s', statusId: 'col-x', order: 0 },
      { id: 'card-t', statusId: 'col-x', order: 1 },
      { id: 'card-a', statusId: 'col-y', order: 0 },
      { id: 'card-b', statusId: 'col-y', order: 1 },
    ])
  })

  // Value: protects=a refused position write puts only the applied column snapshot back, so the next Z retries that layout and never writes the deleted column; fails_when=the next Z does nothing, or a write includes the deleted id; why_new=skipping used to leave the refused step's index pointing at a snapshot that named a missing column; seam=a resolved refusal, not the database; no_claim=the database function
  test('a refused column undo retries the snapshot it applied and leaves the skipped one off the stack', async () => {
    // Arrange: newer snapshot names Shipped, which is gone; the older one does not
    const dispatch = vi.fn()
    const olderSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 1),
    ]
    const newerSnapshot = [
      ...olderSnapshot,
      makeColumn('col-c', 'Shipped', 0, 2),
    ]
    const columnsNow = [
      makeColumn('col-b', 'Building', 0, 0),
      makeColumn('col-a', 'Ideas', 0, 1),
    ]
    vi.mocked(batchUpdateStatusListPositions).mockResolvedValueOnce({
      success: false,
      error: 'The column update matched no row.',
    })
    const rollbackStatusLists = vi.fn(() => 'restored' as const)
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists,
        }),
      { initialProps: { statuses: olderSnapshot } },
    )
    act(() => {
      result.current.pushColumnHistory(olderSnapshot)
      result.current.pushColumnHistory(newerSnapshot)
    })
    rerender({ statuses: columnsNow })

    // Act: the write is refused, then Z tries again
    pressUndoKey()
    await act(async () => {
      await vi.waitFor(() => {
        expect(rollbackStatusLists).toHaveBeenCalled()
      })
    })
    pressUndoKey()
    // The skipped snapshot must not still be on the stack. An empty stack
    // stays quiet. A leftover entry that names the deleted column would say
    // there is nothing to undo.
    pressUndoKey()

    // Assert: both writes are the older layout. The deleted id is never sent.
    expect(batchUpdateStatusListPositions).toHaveBeenCalledTimes(2)
    expect(batchUpdateStatusListPositions).toHaveBeenNthCalledWith(1, [
      { id: 'col-a', gridRow: 0, gridCol: 0 },
      { id: 'col-b', gridRow: 0, gridCol: 1 },
    ])
    expect(batchUpdateStatusListPositions).toHaveBeenNthCalledWith(2, [
      { id: 'col-a', gridRow: 0, gridCol: 0 },
      { id: 'col-b', gridRow: 0, gridCol: 1 },
    ])
    const writtenIds = vi
      .mocked(batchUpdateStatusListPositions)
      .mock.calls.flatMap((call) => call[0].map((update) => update.id))
    expect(writtenIds).not.toContain('col-c')
    expect(toast.info).not.toHaveBeenCalled()
  })

  test('undoing a drag leaves a card that was since moved to another board alone', () => {
    // Arrange: snapshot taken before card-1 was dragged from To Do to Done
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ]
    const { result, rerender } = renderHook(
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: CARD_COLUMNS,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    // card-1 now sits in Done, and card-2 was moved to another board
    rerender({ cards: [makeCard('card-1', 'gitbox', 'status-done', 0)] })

    // Act
    pressUndoKey()

    // Assert: only card-1 goes back to To Do, on screen and in the database.
    // The cards on screen change exactly once; the other dispatches only
    // count the save as pending.
    const cardUpdates = dispatch.mock.calls
      .map(([action]) => action)
      .filter(setRepoCards.match)
    expect(cardUpdates).toEqual([
      setRepoCards([makeCard('card-1', 'gitbox', 'status-todo', 0)]),
    ])
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
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: CARD_COLUMNS,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
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
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: CARD_COLUMNS,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
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
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: CARD_COLUMNS,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
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

  // Value: protects=one Z undoes the drag that moved a card, even when a
  //   later drag put a card back where it was;
  //   fails_when=Z stops on that empty entry and says there is nothing to undo;
  //   why_new=dropping a card on itself used to be remembered;
  //   seam=none
  test('one Z undoes the earlier drag when the latest remembered drag changed nothing', () => {
    // Arrange: card-2 was dragged above card-1, then a later drag changed nothing
    const dispatch = vi.fn()
    const beforeTheMove = [
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ]
    const afterTheMove = [
      makeCard('card-2', 'corelive', 'status-todo', 0),
      makeCard('card-1', 'gitbox', 'status-todo', 1),
    ]
    const { result } = renderHook(() =>
      useKanbanUndo({
        dispatch,
        cards: afterTheMove,
        statuses: CARD_COLUMNS,
        rollbackRepoCards: vi.fn(),
        rollbackStatusLists: vi.fn(),
      }),
    )
    act(() => {
      result.current.pushCardHistory(beforeTheMove)
      result.current.pushCardHistory(afterTheMove)
    })

    // Act
    pressUndoKey()

    // Assert
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Card operation undone', {
      id: 'board-undo',
    })
    const cardUpdates = dispatch.mock.calls
      .map(([action]) => action)
      .filter(setRepoCards.match)
    expect(cardUpdates).toEqual([
      setRepoCards([
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ]),
    ])
  })

  // Value: protects=the first Z writes only the newer fitting column layout and the second Z writes the older one, with Column order restored twice; fails_when=one Z writes the older layout, or the second Z writes the newer layout again; why_new=two fitting snapshots were only reached when the top one named a deleted column; seam=none; no_claim=the database function
  test('two Z presses restore the newer column layout and then the older one', () => {
    // Arrange: both snapshots name only columns still on the board, at
    // different positions, and the board is in a third layout
    const dispatch = vi.fn()
    const olderSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 1, 0),
    ]
    const newerSnapshot = [
      makeColumn('col-a', 'Ideas', 0, 1),
      makeColumn('col-b', 'Building', 0, 0),
    ]
    const columnsNow = [
      makeColumn('col-a', 'Ideas', 2, 0),
      makeColumn('col-b', 'Building', 2, 1),
    ]
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: olderSnapshot } },
    )
    act(() => {
      result.current.pushColumnHistory(olderSnapshot)
      result.current.pushColumnHistory(newerSnapshot)
    })
    rerender({ statuses: columnsNow })

    // Act
    pressUndoKey()

    // Assert: only the newer layout
    expect(batchUpdateStatusListPositions).toHaveBeenCalledTimes(1)
    expect(batchUpdateStatusListPositions).toHaveBeenCalledWith([
      { id: 'col-a', gridRow: 0, gridCol: 1 },
      { id: 'col-b', gridRow: 0, gridCol: 0 },
    ])

    // Act
    pressUndoKey()

    // Assert: the older layout is the second write, and the toast showed twice
    expect(batchUpdateStatusListPositions).toHaveBeenCalledTimes(2)
    expect(batchUpdateStatusListPositions).toHaveBeenNthCalledWith(2, [
      { id: 'col-a', gridRow: 0, gridCol: 0 },
      { id: 'col-b', gridRow: 1, gridCol: 0 },
    ])
    expect(toast.success).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Column order restored', {
      id: 'board-undo',
    })
  })

  // Value: protects=Z puts snapshot positions back while a renamed column keeps its new name and color and a column added since stays on the board; fails_when=the old name comes back, the added column disappears, or the columns stay where the drag left them; why_new=reconcileColumnUndo keeps the name and color from now and appends a column the snapshot does not name; seam=none; no_claim=a deleted column
  test('undoing a column drag keeps a renamed column and a column added since', () => {
    // Arrange: the snapshot names every column that was here then. Ideas was
    // renamed to Backlog and recolored, and Review was added after the drag.
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 1),
    ]
    const columnsNow = [
      makeColumn('col-d', 'Review', 1, 0, '#16A34A'),
      makeColumn('col-a', 'Backlog', 0, 1, '#2563EB'),
      makeColumn('col-b', 'Building', 0, 0),
    ]
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushColumnHistory(snapshotBeforeDrag)
    })
    rerender({ statuses: columnsNow })

    // Act
    pressUndoKey()

    // Assert: names and colors from now, positions from the snapshot, Review appended
    expect(dispatch).toHaveBeenCalledWith(
      setStatusLists([
        makeColumn('col-a', 'Backlog', 0, 0, '#2563EB'),
        makeColumn('col-b', 'Building', 0, 1),
        makeColumn('col-d', 'Review', 1, 0, '#16A34A'),
      ]),
    )
    expect(batchUpdateStatusListPositions).toHaveBeenCalledTimes(1)
    expect(batchUpdateStatusListPositions).toHaveBeenCalledWith([
      { id: 'col-a', gridRow: 0, gridCol: 0 },
      { id: 'col-b', gridRow: 0, gridCol: 1 },
      { id: 'col-d', gridRow: 1, gridCol: 0 },
    ])
    expect(toast.success).toHaveBeenCalledWith('Column order restored', {
      id: 'board-undo',
    })
  })

  // Value: protects=the first Z after one unfit column snapshot and no cards says there is nothing to undo once, and a second Z stays quiet and writes no positions; fails_when=the second Z toasts again, or either Z calls batchUpdateStatusListPositions; why_new=the skipped snapshot used to stay on the stack, so the next Z said there was nothing to undo again; seam=none; no_claim=the database function
  test('a second Z stays quiet after an unfit column snapshot said there is nothing to undo', () => {
    // Arrange: the only snapshot names Shipped, which is gone, and there are no cards
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-c', 'Shipped', 0, 2),
    ]
    const columnsNow = [makeColumn('col-a', 'Ideas', 0, 1)]
    const { result, rerender } = renderHook(
      ({ statuses }) =>
        useKanbanUndo({
          dispatch,
          cards: [],
          statuses,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { statuses: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushColumnHistory(snapshotBeforeDrag)
    })
    rerender({ statuses: columnsNow })

    // Act
    pressUndoKey()

    // Assert
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith('Nothing to undo on this board')
    expect(batchUpdateStatusListPositions).not.toHaveBeenCalled()

    // Act
    pressUndoKey()

    // Assert: the notice is not repeated, and positions are still not written
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(batchUpdateStatusListPositions).not.toHaveBeenCalled()
  })

  // Value: protects=Z with no column history and no card history shows no toast and writes no column positions; fails_when=toast.success, toast.info, or batchUpdateStatusListPositions runs; why_new=an empty stack and a stack of skipped snapshots both used to reach the same notice; seam=none; no_claim=the database function
  test('Z shows no toast and writes no positions when nothing has been dragged', () => {
    // Arrange: a board with a column and no remembered drag
    const dispatch = vi.fn()
    renderHook(() =>
      useKanbanUndo({
        dispatch,
        cards: [],
        statuses: [makeColumn('col-a', 'Ideas', 0, 0)],
        rollbackRepoCards: vi.fn(),
        rollbackStatusLists: vi.fn(),
      }),
    )

    // Act
    pressUndoKey()

    // Assert
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.info).not.toHaveBeenCalled()
    expect(batchUpdateStatusListPositions).not.toHaveBeenCalled()
  })
})

describe('useKanbanUndo: Z while something lies on top of the board', () => {
  /** The layer a test opened; closed again after it. */
  let openLayer: HTMLElement | null = null

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    openLayer?.remove()
    openLayer = null
  })

  test.each([
    { layer: 'a dialog', role: 'dialog' },
    { layer: 'a confirmation', role: 'alertdialog' },
    { layer: 'a menu', role: 'menu' },
    { layer: 'a list of options', role: 'listbox' },
  ])('does not undo the last drag on the board behind $layer', ({ role }) => {
    // Arrange: card-1 was dragged from To Do to Done, so there is a drag to
    // undo, and a layer is open on top of the board
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [makeCard('card-1', 'gitbox', 'status-todo', 0)]
    const { result, rerender } = renderHook(
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: CARD_COLUMNS,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    rerender({ cards: [makeCard('card-1', 'gitbox', 'status-done', 0)] })
    openLayer = document.createElement('div')
    openLayer.setAttribute('role', role)
    document.body.append(openLayer)

    // Act: the key reaches the window, as it does from a button or a
    // Select inside the layer
    pressUndoKey()

    // Assert: the card stays in Done, on screen and in the database
    expect(dispatch).not.toHaveBeenCalled()
    expect(batchUpdateRepoCardOrders).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  // Value: protects=a board change is not taken back from behind the sidebar that lies over the page below 768px; fails_when=the undo shortcut asks only for dialogs, menus and lists, which the opened sidebar is not; why_new=the layers above all have a role, the sidebar sets the page aside with inert; seam=none; no_claim=that the sidebar sets inert (Sidebar.narrow-viewport.test.tsx)
  test('does not undo the last drag on a board that the opened sidebar has set aside', () => {
    // Arrange: card-1 was dragged from To Do to Done, and the page is inert,
    // as the sidebar makes it while it lies over the page on a phone
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [makeCard('card-1', 'gitbox', 'status-todo', 0)]
    const { result, rerender } = renderHook(
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: CARD_COLUMNS,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    rerender({ cards: [makeCard('card-1', 'gitbox', 'status-done', 0)] })
    openLayer = document.createElement('main')
    openLayer.setAttribute('inert', '')
    document.body.append(openLayer)

    // Act: Z typed on a link of the sidebar reaches the window
    pressUndoKey()

    // Assert: the card stays in Done, on screen and in the database
    expect(dispatch).not.toHaveBeenCalled()
    expect(batchUpdateRepoCardOrders).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  // Value: protects=a board change is not taken back from behind the command palette or the Add Repositories panel; fails_when=the undo shortcut stops asking for the mark of a layer the app builds by hand; why_new=those two have no role of a layer (the panel holds a list of options only while it has repositories to offer), so the rows above do not stand for them; seam=none; no_claim=that the palette and the panel carry the mark (CommandPalette.test.tsx, AddRepositoryCombobox.placements.test.tsx)
  test('does not undo the last drag on the board behind a layer the app builds by hand', () => {
    // Arrange: card-1 was dragged from To Do to Done, and a layer without a
    // role is open, marked as the command palette marks itself
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [makeCard('card-1', 'gitbox', 'status-todo', 0)]
    const { result, rerender } = renderHook(
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: CARD_COLUMNS,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    rerender({ cards: [makeCard('card-1', 'gitbox', 'status-done', 0)] })
    openLayer = document.createElement('div')
    openLayer.setAttribute('data-overlay', 'true')
    document.body.append(openLayer)

    // Act: Z typed on a button of the layer reaches the window
    pressUndoKey()

    // Assert: the card stays in Done, on screen and in the database
    expect(dispatch).not.toHaveBeenCalled()
    expect(batchUpdateRepoCardOrders).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('undoes the last drag again once the layer is closed', () => {
    // Arrange: the same drag, and a dialog that was open and is gone again
    const dispatch = vi.fn()
    const snapshotBeforeDrag = [makeCard('card-1', 'gitbox', 'status-todo', 0)]
    const { result, rerender } = renderHook(
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: CARD_COLUMNS,
          rollbackRepoCards: vi.fn(),
          rollbackStatusLists: vi.fn(),
        }),
      { initialProps: { cards: snapshotBeforeDrag } },
    )
    act(() => {
      result.current.pushCardHistory(snapshotBeforeDrag)
    })
    rerender({ cards: [makeCard('card-1', 'gitbox', 'status-done', 0)] })
    const closedDialog = document.createElement('div')
    closedDialog.setAttribute('role', 'dialog')
    document.body.append(closedDialog)
    closedDialog.remove()

    // Act
    pressUndoKey()

    // Assert
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledTimes(1)
    expect(batchUpdateRepoCardOrders).toHaveBeenCalledWith([
      { id: 'card-1', statusId: 'status-todo', order: 0 },
    ])
  })
})
