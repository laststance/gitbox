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
      ({ cards }) =>
        useKanbanUndo({
          dispatch,
          cards,
          statuses: [],
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
          statuses: [],
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
          statuses: [],
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
          statuses: [],
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
          statuses: [],
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
          statuses: [],
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
          statuses: [],
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
          statuses: [],
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
