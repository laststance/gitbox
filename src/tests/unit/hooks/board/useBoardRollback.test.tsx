/**
 * Unit Tests: failed saves on a board (useBoardRollback and its callers)
 *
 * When a drag, an undo or a remove fails to save, the screen goes back to what
 * the database holds. The handlers used to dispatch the cards or columns
 * captured when the action started, so a change made while the request was in
 * flight was lost: a removed card came back, an added card vanished, and after
 * navigating, another board showed the previous board's cards or columns.
 *
 * Every test here holds the save open with a deferred rejection, changes the
 * store in between when the scenario needs it, then lets the save fail.
 *
 * The last block covers a save that gets no answer at all: after 15 seconds
 * the user is told, the board is read through the route (a Server Action
 * would wait behind that save) and what the user did stays on screen until
 * that copy arrives. A refused save asks for {@link getBoardBundle}.
 *
 * @see src/hooks/board/useBoardRollback.ts
 */

import type { DragEndEvent } from '@dnd-kit/core'
import { configureStore } from '@reduxjs/toolkit'
import * as Sentry from '@sentry/nextjs'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { COLUMN_INSERT_DROP_TYPE } from '@/components/Board/ColumnInsertZone'
import { NEW_ROW_DROP_TYPE } from '@/components/Board/NewRowDropZone'
import { COLUMN_DRAG_TYPE } from '@/components/Board/SortableColumn'
import { useBoardRollback } from '@/hooks/board/useBoardRollback'
import { useBoardServerSync } from '@/hooks/board/useBoardServerSync'
import { useKanbanDnD } from '@/hooks/board/useKanbanDnD'
import { useKanbanUndo } from '@/hooks/board/useKanbanUndo'
import { useOptimisticCardAction } from '@/hooks/board/useOptimisticCardAction'
import {
  batchUpdateRepoCardOrders,
  batchUpdateStatusListPositions,
  swapStatusListPositions,
  updateRepoCardPosition,
  updateStatusListPosition,
} from '@/lib/actions/board'
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import boardReducer, {
  addRepoCards,
  removeRepoCard,
  selectRepoCards,
  selectStatusLists,
  setRepoCards,
  setStatusLists,
} from '@/lib/redux/slices/boardSlice'
import boardSyncReducer, {
  selectMayApplyServerSnapshot,
} from '@/lib/redux/slices/boardSyncSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'
import { reloadPage } from '@/lib/utils/reload-page'

const { readBoard, readBoardOutsideTheQueue } = vi.hoisted(() => ({
  readBoard: vi.fn(async (): Promise<null> => new Promise(() => undefined)),
  readBoardOutsideTheQueue: vi.fn(
    async (): Promise<null> => new Promise(() => undefined),
  ),
}))

vi.mock('@/lib/actions/board-data', () => ({
  getBoardBundle: readBoard,
}))

vi.mock('@/lib/fetch-board-bundle', () => ({
  fetchBoardBundle: readBoardOutsideTheQueue,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  unstable_isUnrecognizedActionError: (error: unknown) =>
    error instanceof Error && error.name === 'UnrecognizedActionError',
}))

vi.mock('@/lib/actions/board', () => ({
  updateRepoCardPosition: vi.fn(async () => undefined),
  batchUpdateRepoCardOrders: vi.fn(async () => undefined),
  swapStatusListPositions: vi.fn(async () => undefined),
  batchUpdateStatusListPositions: vi.fn(async () => undefined),
  updateStatusListPosition: vi.fn(async () => undefined),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
}))

/** A card for `laststance/<repoName>` on the given board, column and position. */
function makeCard(
  id: string,
  repoName: string,
  statusId: string,
  order: number,
  boardId = 'board-1',
): RepoCardForRedux {
  return {
    id: toRepoCardId(id),
    title: `laststance/${repoName}`,
    statusId: toStatusListId(statusId),
    boardId: toBoardId(boardId),
    repoOwner: 'laststance',
    repoName,
    order,
    meta: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** A column in the first grid row of the given board. */
function makeColumn(
  id: string,
  title: string,
  gridCol: number,
  boardId = 'board-1',
): StatusListDomain {
  return {
    id: toStatusListId(id),
    title,
    color: '#6B7280',
    gridRow: 0,
    gridCol,
    boardId: toBoardId(boardId),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** A save the test fails on demand, so it can change the board while it is pending. */
function holdSaveOpen(): { failSave: () => void; pendingSave: Promise<never> } {
  let failSave = (): void => undefined
  const pendingSave = new Promise<never>((_resolve, reject) => {
    failSave = (): void => reject(new Error('Save refused'))
  })
  return { failSave, pendingSave }
}

/** A save the test lets through on demand, so it can look at the board while it is pending. */
function holdSuccessfulSaveOpen(): {
  finishSave: () => void
  pendingSave: Promise<undefined>
} {
  let finishSave = (): void => undefined
  const pendingSave = new Promise<undefined>((resolve) => {
    finishSave = (): void => resolve(undefined)
  })
  return { finishSave, pendingSave }
}

/**
 * A position write the test lets through. Those actions answer
 * `{ success: true }` instead of resolving to nothing.
 */
function holdSuccessfulPositionSaveOpen(): {
  finishSave: () => void
  pendingSave: Promise<{ success: true; data: undefined }>
} {
  let finishSave = (): void => undefined
  const pendingSave = new Promise<{ success: true; data: undefined }>(
    (resolve) => {
      finishSave = (): void => resolve({ success: true, data: undefined })
    },
  )
  return { finishSave, pendingSave }
}

/**
 * The board page's own part: it puts the page data into the store and fetches
 * the board again when a failed save asks for it.
 */
function BoardPageData({
  repoCards,
  statusLists,
}: {
  repoCards: RepoCardForRedux[]
  statusLists: StatusListDomain[]
}): null {
  useBoardServerSync({ boardId: toBoardId('board-1'), statusLists, repoCards })
  return null
}

/** A store holding one open board, and the provider that hands it to the hooks. */
function createBoardStore(
  repoCards: RepoCardForRedux[],
  statusLists: StatusListDomain[],
) {
  const store = configureStore({
    reducer: { board: boardReducer, boardSync: boardSyncReducer },
    preloadedState: {
      board: {
        statusLists,
        repoCards,
      },
    },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <BoardPageData repoCards={repoCards} statusLists={statusLists} />
      {children}
    </Provider>
  )
  return { store, wrapper }
}

/** The board's drag and undo hooks wired the way KanbanBoard wires them. */
function useBoardDragAndUndo() {
  const dispatch = useAppDispatch()
  const statuses = useAppSelector(selectStatusLists)
  const cards = useAppSelector(selectRepoCards)
  const { rollbackRepoCards, rollbackStatusLists } = useBoardRollback()
  const { pushCardHistory, pushColumnHistory } = useKanbanUndo({
    dispatch,
    cards,
    statuses,
    rollbackRepoCards,
    rollbackStatusLists,
  })
  const cardsByStatus: Record<string, RepoCardForRedux[]> = {}
  for (const card of cards) {
    ;(cardsByStatus[card.statusId] ??= []).push(card)
  }
  return useKanbanDnD({
    statuses,
    cards,
    cardsByStatus,
    EMPTY_CARDS: [],
    dispatch,
    pushCardHistory,
    pushColumnHistory,
    rollbackRepoCards,
    rollbackStatusLists,
  })
}

/** The drop of a card onto a column, as @dnd-kit reports it. */
function dropCardOnColumn(cardId: string, statusId: string): DragEndEvent {
  return {
    active: { id: cardId, data: { current: {} } },
    over: {
      id: `droppable-${statusId}`,
      data: { current: { type: 'column', statusId } },
    },
  } as unknown as DragEndEvent
}

/** The drop of a card onto another card, as @dnd-kit reports it. */
function dropCardOnCard(cardId: string, overCardId: string): DragEndEvent {
  return {
    active: { id: cardId, data: { current: {} } },
    over: { id: overCardId, data: { current: {} } },
  } as unknown as DragEndEvent
}

/** The drop of a column onto the "new row" zone, as @dnd-kit reports it. */
function dropColumnOnNewRow(statusId: string, targetRow: number): DragEndEvent {
  return {
    active: { id: statusId, data: { current: { type: COLUMN_DRAG_TYPE } } },
    over: {
      id: `new-row-${targetRow}`,
      data: {
        current: { type: NEW_ROW_DROP_TYPE, gridRow: targetRow, gridCol: 0 },
      },
    },
  } as unknown as DragEndEvent
}

/** The drop of a column onto an empty grid cell, as @dnd-kit reports it. */
function dropColumnOnEmptyCell(
  statusId: string,
  gridRow: number,
  gridCol: number,
): DragEndEvent {
  return {
    active: { id: statusId, data: { current: { type: COLUMN_DRAG_TYPE } } },
    over: {
      id: `insert-zone-${gridRow}-${gridCol}`,
      data: { current: { type: COLUMN_INSERT_DROP_TYPE, gridRow, gridCol } },
    },
  } as unknown as DragEndEvent
}

/** The drop of a column onto another column, as @dnd-kit reports it. */
function dropColumnOnColumn(
  statusId: string,
  overStatusId: string,
): DragEndEvent {
  return {
    active: { id: statusId, data: { current: { type: COLUMN_DRAG_TYPE } } },
    over: { id: overStatusId, data: { current: {} } },
  } as unknown as DragEndEvent
}

/** Press the bare Z key the way a user does outside any input. */
function pressUndoKey(): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }))
  })
}

describe('failed saves on a board', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('a card drag that fails to save returns the card to its column and says so', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(updateRepoCardPosition).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
      failSave()
      await drag
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Failed to move card', {
      id: 'board-save-failed',
      description: 'Reloading the board to show what was saved.',
    })
  })

  test('a card drag that fails to save does not bring back a card removed while it was saving', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(updateRepoCardPosition).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act: card-2 is removed while the drag of card-1 is still saving
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
      store.dispatch(removeRepoCard(toRepoCardId('card-2')))
      failSave()
      await drag
    })

    // Assert: card-2 stays removed and the board is fetched again
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-done', 0),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('a card drag that fails to save after another board was opened leaves that board alone', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(updateRepoCardPosition).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act: the next board hydrates the store before the save fails
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
      store.dispatch(
        setRepoCards([makeCard('card-9', 'nsx', 'status-idea', 0, 'board-2')]),
      )
      failSave()
      await drag
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-9', 'nsx', 'status-idea', 0, 'board-2'),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  // Generated by /ship test coverage audit (2026-10-11).
  // Value: protects=a failed reorder inside one column puts the cards back in
  //   their saved order;
  //   fails_when=the reorder handler rolls back with an array other than the one
  //   it dispatched, or stops rolling back;
  //   why_new=the other card-drag tests only move a card to another column,
  //   which is a separate branch of handleDragEnd;
  //   seam=none; no_claim=that the server refuses the write or that a real
  //   @dnd-kit drag reports this event (board actions and the drop are faked)
  test('a card reorder within a column that fails to save returns the cards to their order and says so', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [makeColumn('status-todo', 'To Do', 0)],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    let cardsWhileSaving: RepoCardForRedux[] = []

    // Act: card-1 is dropped below card-2, then the save fails
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropCardOnCard('card-1', 'card-2'),
      )
      cardsWhileSaving = store.getState().board.repoCards
      failSave()
      await drag
    })

    // Assert: the new order was on screen while saving, then the old one is back
    expect(cardsWhileSaving).toEqual([
      makeCard('card-2', 'corelive', 'status-todo', 1),
      makeCard('card-1', 'gitbox', 'status-todo', 0),
    ])
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Failed to move card', {
      id: 'board-save-failed',
      description: 'Reloading the board to show what was saved.',
    })
  })

  test('a column drag that fails to save returns the columns to their places and says so', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(swapStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
      failSave()
      await drag
    })

    // Assert
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 0),
      makeColumn('status-done', 'Done', 1),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Failed to move column', {
      id: 'board-save-failed',
      description: 'Reloading the board to show what was saved.',
    })
  })

  test('a column drag that fails to save after another board was opened leaves that board alone', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(swapStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act: the next board hydrates the store before the save fails
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
      store.dispatch(
        setStatusLists([makeColumn('status-idea', 'Ideas', 0, 'board-2')]),
      )
      failSave()
      await drag
    })

    // Assert
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-idea', 'Ideas', 0, 'board-2'),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  // Generated by /ship test coverage audit (2026-10-11).
  // Value: protects=a column dragged to a new row returns to its old row when
  //   the save fails;
  //   fails_when=the new-row handler rolls back with an array other than the one
  //   it dispatched, or stops rolling back;
  //   why_new=the column tests above only swap two columns; the new-row drop is
  //   a separate handler with its own rollback call;
  //   seam=none; no_claim=that the server refuses the write or that a real
  //   @dnd-kit drag reports this event (board actions and the drop are faked)
  test('a column dragged to a new row that fails to save returns to its row and says so', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(updateStatusListPosition).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    let columnsWhileSaving: StatusListDomain[] = []

    // Act: Done is dropped on the new-row zone, then the save fails
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropColumnOnNewRow('status-done', 1),
      )
      columnsWhileSaving = store.getState().board.statusLists
      failSave()
      await drag
    })

    // Assert: Done sat alone in the second row while saving, then went back
    expect(columnsWhileSaving).toEqual([
      makeColumn('status-todo', 'To Do', 0),
      { ...makeColumn('status-done', 'Done', 0), gridRow: 1 },
    ])
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 0),
      makeColumn('status-done', 'Done', 1),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Failed to move column', {
      id: 'board-save-failed',
      description: 'Reloading the board to show what was saved.',
    })
  })

  test('a column dragged to a new row past row 999 returns to its row and the refusal is the toast', async () => {
    // Arrange: the action answers with the grid-bound sentence instead of throwing
    vi.mocked(updateStatusListPosition).mockResolvedValueOnce({
      success: false,
      error: 'A column cannot sit past row 999 or column 999.',
    })
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    await act(async () => {
      await result.current.handleDragEnd(dropColumnOnNewRow('status-done', 1))
    })

    // Assert
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 0),
      makeColumn('status-done', 'Done', 1),
    ])
    expect(toast.error).toHaveBeenCalledWith('Failed to move column', {
      id: 'board-save-failed',
      description: 'A column cannot sit past row 999 or column 999.',
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(readBoard).not.toHaveBeenCalled()
  })

  // Generated by /ship test coverage audit (2026-10-11).
  // Value: protects=a column dropped on an empty grid cell returns to its old
  //   cell when the save fails;
  //   fails_when=the insert-zone handler rolls back with an array other than the
  //   one it dispatched, or stops rolling back;
  //   why_new=no test drops a column on an insert zone; that handler builds its
  //   own column array and has its own rollback call;
  //   seam=none; no_claim=that the server refuses the write or that a real
  //   @dnd-kit drag reports this event (board actions and the drop are faked)
  test('a column dropped on an empty cell that fails to save returns to its cell and says so', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    let columnsWhileSaving: StatusListDomain[] = []

    // Act: To Do is dropped on the empty cell right of Done; the save fails
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropColumnOnEmptyCell('status-todo', 0, 2),
      )
      columnsWhileSaving = store.getState().board.statusLists
      failSave()
      await drag
    })

    // Assert: To Do sat in the third cell while saving, then went back
    expect(columnsWhileSaving).toEqual([
      makeColumn('status-todo', 'To Do', 2),
      makeColumn('status-done', 'Done', 1),
    ])
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 0),
      makeColumn('status-done', 'Done', 1),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Failed to move column', {
      id: 'board-save-failed',
      description: 'Reloading the board to show what was saved.',
    })
  })

  test('puts the cards back as they were when the database refuses the undo', async () => {
    // Arrange: card-1 was dragged from To Do to Done and that drag was saved
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })

    // Act: the undo is refused, e.g. the old column was deleted since
    pressUndoKey()
    await act(async () => {
      failSave()
      await pendingSave.catch(() => undefined)
    })

    // Assert: the screen shows the layout the database still holds
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-done', 0),
    ])
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to sync undo to database',
      {
        id: 'board-undo',
        description: 'Reloading the board to show what was saved.',
      },
    )
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('the next Z retries an undo whose save was refused', async () => {
    // Arrange: card-1 was dragged from To Do to Done and that drag was saved
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })
    pressUndoKey()
    await act(async () => {
      failSave()
      await pendingSave.catch(() => undefined)
    })

    // Act: Z again, and this save is kept
    pressUndoKey()
    await act(async () => undefined)

    // Assert: the refused undo ran again, so the card is back in To Do
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
    ])
    expect(vi.mocked(batchUpdateRepoCardOrders)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(batchUpdateRepoCardOrders)).toHaveBeenLastCalledWith([
      {
        id: toRepoCardId('card-1'),
        statusId: toStatusListId('status-todo'),
        order: 0,
      },
    ])
  })

  test('a second refusal of the same undo leaves the older step', async () => {
    // Arrange: card-1 then card-2 were dragged onto Done
    const firstRefusal = holdSaveOpen()
    const secondRefusal = holdSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders)
      .mockReturnValueOnce(firstRefusal.pendingSave)
      .mockReturnValueOnce(secondRefusal.pendingSave)
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-2', 'status-done'),
      )
    })
    pressUndoKey()
    await act(async () => {
      firstRefusal.failSave()
      await firstRefusal.pendingSave.catch(() => undefined)
    })
    pressUndoKey()
    await act(async () => {
      secondRefusal.failSave()
      await secondRefusal.pendingSave.catch(() => undefined)
    })

    // Act: Z reaches the drag of card-1, under the step that failed twice
    pressUndoKey()
    await act(async () => undefined)

    // Assert: both cards are back in To Do. The refused step did not stay on top.
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ])
    expect(vi.mocked(batchUpdateRepoCardOrders)).toHaveBeenCalledTimes(3)
  })

  test('an undo whose board moved on is not tried again', async () => {
    // Arrange: the undo is still saving when another card appears
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })
    pressUndoKey()
    act(() => {
      store.dispatch(
        setRepoCards([
          makeCard('card-1', 'gitbox', 'status-done', 0),
          makeCard('card-2', 'corelive', 'status-todo', 0),
        ]),
      )
    })
    await act(async () => {
      failSave()
      await pendingSave.catch(() => undefined)
    })

    // Act
    pressUndoKey()
    await act(async () => undefined)

    // Assert: the step was not put back, so Z does not write card positions again
    expect(vi.mocked(batchUpdateRepoCardOrders)).toHaveBeenCalledTimes(1)
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-done', 0),
      makeCard('card-2', 'corelive', 'status-todo', 0),
    ])
  })

  test('a refused column undo shows the columns the database still holds', async () => {
    // Arrange: To Do and Done were swapped and that swap was saved
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })

    // Act: the undo is refused
    pressUndoKey()
    await act(async () => {
      failSave()
      await pendingSave.catch(() => undefined)
    })

    // Assert: the swapped layout, which the database still holds, is back
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 1),
      makeColumn('status-done', 'Done', 0),
    ])
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to sync undo to database',
      {
        id: 'board-undo',
        description: 'Reloading the board to show what was saved.',
      },
    )
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('the next Z retries a column undo whose save was refused', async () => {
    // Arrange: To Do and Done were swapped and that swap was saved
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })
    pressUndoKey()
    await act(async () => {
      failSave()
      await pendingSave.catch(() => undefined)
    })

    // Act: Z again, and this save is kept
    pressUndoKey()
    await act(async () => undefined)

    // Assert: the swap is undone
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 0),
      makeColumn('status-done', 'Done', 1),
    ])
    expect(vi.mocked(batchUpdateStatusListPositions)).toHaveBeenCalledTimes(2)
  })

  test('a second refusal of the same column undo is not tried again', async () => {
    // Arrange: the grid bound will not go away, so a third Z must not send it
    vi.mocked(batchUpdateStatusListPositions)
      .mockResolvedValueOnce({
        success: false,
        error: 'A column cannot sit past row 999 or column 999.',
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'A column cannot sit past row 999 or column 999.',
      })
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })
    pressUndoKey()
    await act(async () => undefined)
    pressUndoKey()
    await act(async () => undefined)

    // Act
    pressUndoKey()
    await act(async () => undefined)

    // Assert: two tries, then the step is gone and the swapped layout stays
    expect(vi.mocked(batchUpdateStatusListPositions)).toHaveBeenCalledTimes(2)
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 1),
      makeColumn('status-done', 'Done', 0),
    ])
  })

  test('a column undo past the grid bound puts the columns back and the refusal is the toast', async () => {
    // Arrange: To Do and Done were swapped and that swap was saved
    vi.mocked(batchUpdateStatusListPositions).mockResolvedValueOnce({
      success: false,
      error: 'A column cannot sit past row 999 or column 999.',
    })
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })

    // Act: the undo answers with the grid-bound sentence
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }))
    })

    // Assert: the swapped layout, which the database still holds, is back
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 1),
      makeColumn('status-done', 'Done', 0),
    ])
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to sync undo to database',
      {
        id: 'board-undo',
        description: 'A column cannot sit past row 999 or column 999.',
      },
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('a refused undo keeps a card that was added while it was saving', async () => {
    // Arrange: card-1 was dragged from To Do to Done and that drag was saved
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })

    // Act: a repository is added while the undo is still saving
    pressUndoKey()
    await act(async () => {
      store.dispatch(
        addRepoCards([makeCard('card-2', 'corelive', 'status-todo', 1)]),
      )
      failSave()
      await pendingSave.catch(() => undefined)
    })

    // Assert: the added card is still there and the board is fetched again
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('a remove that fails to save shows the card again', async () => {
    // Arrange
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [makeColumn('status-todo', 'To Do', 0)],
    )
    const { result } = renderHook(() => useOptimisticCardAction(), { wrapper })

    // Act
    await act(async () => {
      await result.current(
        toRepoCardId('card-1'),
        async () => ({ success: false, error: 'Card is locked' }),
        { actionName: 'removeFromBoard', errorMessage: 'Failed to remove' },
      )
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ])
    expect(readBoard).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Failed to remove', {
      id: 'board-save-failed',
      description: 'Card is locked',
    })
  })

  // Generated by /ship test coverage audit (2026-10-11).
  // Value: protects=a remove whose request throws (e.g. the network is down)
  //   shows the card again and tells the user to retry;
  //   fails_when=the catch branch of useOptimisticCardAction stops rolling back
  //   or rolls back with the wrong arrays;
  //   why_new=the two remove tests only cover a server action that answers
  //   success: false, which is a different branch;
  //   seam=none; no_claim=that a real network failure rejects the server action
  //   this way (the action is a stub; sonner and Sentry are mocked)
  test('a remove whose request throws shows the card again and asks to retry', async () => {
    // Arrange
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [makeColumn('status-todo', 'To Do', 0)],
    )
    const { result } = renderHook(() => useOptimisticCardAction(), { wrapper })

    // Act
    await act(async () => {
      await result.current(
        toRepoCardId('card-1'),
        async () => {
          throw new Error('Network request failed')
        },
        { actionName: 'removeFromBoard', errorMessage: 'Failed to remove' },
      )
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Failed to remove', {
      id: 'board-save-failed',
      description: 'Reloading the board to show what was saved.',
    })
  })

  test('a remove that fails to save does not undo a drag made while it was saving', async () => {
    // Arrange
    let failRemove = (): void => undefined
    const pendingRemove = new Promise<{ success: false; error: string }>(
      (resolve) => {
        failRemove = (): void =>
          resolve({ success: false, error: 'Card is locked' })
      },
    )
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useOptimisticCardAction(), { wrapper })

    // Act: card-2 is moved to Done while the removal of card-1 is still saving
    await act(async () => {
      const removal = result.current(
        toRepoCardId('card-1'),
        async () => pendingRemove,
        { actionName: 'removeFromBoard', errorMessage: 'Failed to remove' },
      )
      store.dispatch(
        setRepoCards([makeCard('card-2', 'corelive', 'status-done', 0)]),
      )
      failRemove()
      await removal
    })

    // Assert: the drag is kept and the board is fetched again
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-2', 'corelive', 'status-done', 0),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('a card drag that fails after the board changed says the board is reloading instead of asking to retry', async () => {
    // Arrange
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(updateRepoCardPosition).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act: card-2 is removed while the drag of card-1 is still saving, so
    // nothing can be put back when the save fails
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
      store.dispatch(removeRepoCard(toRepoCardId('card-2')))
      failSave()
      await drag
    })

    // Assert
    expect(toast.error).toHaveBeenCalledWith('Failed to move card', {
      id: 'board-save-failed',
      description: 'Reloading the board to show what was saved.',
    })
  })

  test('a card drag that fails while offline says to wait for the connection', async () => {
    // Arrange: the browser has lost its connection
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(updateRepoCardPosition).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    await act(async () => {
      const drag = result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
      failSave()
      await drag
    })

    // Assert: the card went back. The failure toast is not shown: the
    // offline notice is the one sentence, and the board is fetched when
    // the connection returns.
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
    ])
    expect(toast.error).not.toHaveBeenCalled()
    expect(store.getState().boardSync.isRefreshWanted).toBe(true)
    expect(readBoard).not.toHaveBeenCalled()
  })

  test('a refused undo replaces its "undone" message with the failure message', async () => {
    // Arrange: card-1 was dragged from To Do to Done and that drag was saved
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(pendingSave)
    const { wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })

    // Act: the undo is refused
    pressUndoKey()
    await act(async () => {
      failSave()
      await pendingSave.catch(() => undefined)
    })

    // Assert: both toasts carry one id, so the second takes the first's place
    expect(toast.success).toHaveBeenCalledWith('Card operation undone', {
      id: 'board-undo',
    })
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to sync undo to database',
      {
        id: 'board-undo',
        description: 'Reloading the board to show what was saved.',
      },
    )
  })

  test('a refused column undo does not take back a later undo of the same layout', async () => {
    // Arrange: To Do and Done are swapped, and the first undo of that swap is
    // still saving
    const { failSave, pendingSave } = holdSaveOpen()
    vi.mocked(batchUpdateStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })
    pressUndoKey()
    // The columns are swapped again and that swap is undone too; both save
    await act(async () => {
      await result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })
    pressUndoKey()
    await act(async () => undefined)

    // Act: only now the first undo is refused
    await act(async () => {
      failSave()
      await pendingSave.catch(() => undefined)
    })

    // Assert: the second undo, which the database holds, stays on screen and
    // the board is fetched again instead of swapping the columns back
    expect(store.getState().board.statusLists).toEqual([
      makeColumn('status-todo', 'To Do', 0),
      makeColumn('status-done', 'Done', 1),
    ])
    expect(readBoard).toHaveBeenCalledTimes(1)
  })
})

/**
 * While a save is on its way, board data that the server sends again may have
 * been read before that save landed. useBoardServerSync keeps such data out
 * of the store by asking selectMayApplyServerSnapshot, which answers "no"
 * only for writes counted by trackBoardWrite. One test per write the board
 * sends: a write that is not counted lets old data move the card back.
 */
describe('a save in flight keeps board data fetched again out of the store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('while a card moved to another column is saving', async () => {
    // Arrange
    const { finishSave, pendingSave } = holdSuccessfulSaveOpen()
    vi.mocked(updateRepoCardPosition).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    let drag: Promise<void> = Promise.resolve()
    act(() => {
      drag = result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })
    const mayApplyWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await act(async () => {
      finishSave()
      await drag
    })

    // Assert
    expect(mayApplyWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
  })

  test('while a card reordered within its column is saving', async () => {
    // Arrange
    const { finishSave, pendingSave } = holdSuccessfulSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [makeColumn('status-todo', 'To Do', 0)],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    let drag: Promise<void> = Promise.resolve()
    act(() => {
      drag = result.current.handleDragEnd(dropCardOnCard('card-1', 'card-2'))
    })
    const mayApplyWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await act(async () => {
      finishSave()
      await drag
    })

    // Assert
    expect(mayApplyWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
  })

  test('while two swapped columns are saving', async () => {
    // Arrange
    const { finishSave, pendingSave } = holdSuccessfulSaveOpen()
    vi.mocked(swapStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    let drag: Promise<void> = Promise.resolve()
    act(() => {
      drag = result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })
    const mayApplyWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await act(async () => {
      finishSave()
      await drag
    })

    // Assert
    expect(mayApplyWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
  })

  test('while a column dragged to a new row is saving', async () => {
    // Arrange
    const { finishSave, pendingSave } = holdSuccessfulPositionSaveOpen()
    vi.mocked(updateStatusListPosition).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    let drag: Promise<void> = Promise.resolve()
    act(() => {
      drag = result.current.handleDragEnd(dropColumnOnNewRow('status-done', 1))
    })
    const mayApplyWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await act(async () => {
      finishSave()
      await drag
    })

    // Assert
    expect(mayApplyWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
  })

  test('while a column dropped on an empty cell is saving', async () => {
    // Arrange
    const { finishSave, pendingSave } = holdSuccessfulPositionSaveOpen()
    vi.mocked(batchUpdateStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    let drag: Promise<void> = Promise.resolve()
    act(() => {
      drag = result.current.handleDragEnd(
        dropColumnOnEmptyCell('status-todo', 0, 2),
      )
    })
    const mayApplyWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await act(async () => {
      finishSave()
      await drag
    })

    // Assert
    expect(mayApplyWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
  })

  test('while the undo of a card drag is saving', async () => {
    // Arrange: card-1 was dragged from To Do to Done and that drag was saved
    const { finishSave, pendingSave } = holdSuccessfulSaveOpen()
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })

    // Act
    pressUndoKey()
    const mayApplyWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await act(async () => {
      finishSave()
      await pendingSave
    })

    // Assert
    expect(mayApplyWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
  })

  test('while the undo of a column drag is saving', async () => {
    // Arrange: To Do and Done were swapped and that swap was saved
    const { finishSave, pendingSave } = holdSuccessfulPositionSaveOpen()
    vi.mocked(batchUpdateStatusListPositions).mockReturnValueOnce(pendingSave)
    const { store, wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })

    // Act
    pressUndoKey()
    const mayApplyWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await act(async () => {
      finishSave()
      await pendingSave
    })

    // Assert
    expect(mayApplyWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
  })

  test('while a card removed from the board is saving', async () => {
    // Arrange
    let finishRemove = (): void => undefined
    const pendingRemove = new Promise<{ success: true }>((resolve) => {
      finishRemove = (): void => resolve({ success: true })
    })
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [makeColumn('status-todo', 'To Do', 0)],
    )
    const { result } = renderHook(() => useOptimisticCardAction(), { wrapper })

    // Act
    let removal: Promise<void> = Promise.resolve()
    act(() => {
      removal = result.current(
        toRepoCardId('card-1'),
        async () => pendingRemove,
        { actionName: 'removeFromBoard', errorMessage: 'Failed to remove' },
      )
    })
    const mayApplyWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await act(async () => {
      finishRemove()
      await removal
    })

    // Assert
    expect(mayApplyWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
  })
})

describe('a save that gets no answer within 15 seconds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('a card moved to another column stays where it was dropped, the user is told the save is unconfirmed and the board is fetched again', async () => {
    // Arrange: the server never answers the save
    vi.mocked(updateRepoCardPosition).mockReturnValueOnce(
      new Promise<never>(() => {}),
    )
    const { store, wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    act(() => {
      void result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(toast.warning).toHaveBeenCalledWith(
      'Could not confirm that the change was saved',
      {
        id: 'board-save-unconfirmed',
        description:
          'The board reloads when the server answers. Reload the page to see what was saved now.',
        duration: 8000,
        action: { label: 'Reload page', onClick: reloadPage },
      },
    )
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoard).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'syncCardPosition' } },
    )
    // What the user did stays on screen until the fetched board arrives
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-1', 'gitbox', 'status-done', 0),
    ])
  })

  test('a card reordered within its column: the user is told the save is unconfirmed and the board is fetched again', async () => {
    // Arrange: the server never answers the save
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(
      new Promise<never>(() => {}),
    )
    const { wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [makeColumn('status-todo', 'To Do', 0)],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    act(() => {
      void result.current.handleDragEnd(dropCardOnCard('card-1', 'card-2'))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(toast.warning).toHaveBeenCalledWith(
      'Could not confirm that the change was saved',
      {
        id: 'board-save-unconfirmed',
        description:
          'The board reloads when the server answers. Reload the page to see what was saved now.',
        duration: 8000,
        action: { label: 'Reload page', onClick: reloadPage },
      },
    )
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoard).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'syncCardOrder' } },
    )
  })

  test('two swapped columns: the user is told the save is unconfirmed and the board is fetched again', async () => {
    // Arrange: the server never answers the save
    vi.mocked(swapStatusListPositions).mockReturnValueOnce(
      new Promise<never>(() => {}),
    )
    const { wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    act(() => {
      void result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(toast.warning).toHaveBeenCalledWith(
      'Could not confirm that the change was saved',
      {
        id: 'board-save-unconfirmed',
        description:
          'The board reloads when the server answers. Reload the page to see what was saved now.',
        duration: 8000,
        action: { label: 'Reload page', onClick: reloadPage },
      },
    )
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoard).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'swapColumnPositions' } },
    )
  })

  test('a column dragged to a new row: the user is told the save is unconfirmed and the board is fetched again', async () => {
    // Arrange: the server never answers the save
    vi.mocked(updateStatusListPosition).mockReturnValueOnce(
      new Promise<never>(() => {}),
    )
    const { wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    act(() => {
      void result.current.handleDragEnd(dropColumnOnNewRow('status-done', 1))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(toast.warning).toHaveBeenCalledWith(
      'Could not confirm that the change was saved',
      {
        id: 'board-save-unconfirmed',
        description:
          'The board reloads when the server answers. Reload the page to see what was saved now.',
        duration: 8000,
        action: { label: 'Reload page', onClick: reloadPage },
      },
    )
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoard).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'moveColumnToNewRow' } },
    )
  })

  test('a column dropped on an empty cell: the user is told the save is unconfirmed and the board is fetched again', async () => {
    // Arrange: the server never answers the save
    vi.mocked(batchUpdateStatusListPositions).mockReturnValueOnce(
      new Promise<never>(() => {}),
    )
    const { wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    act(() => {
      void result.current.handleDragEnd(
        dropColumnOnEmptyCell('status-todo', 0, 2),
      )
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(toast.warning).toHaveBeenCalledWith(
      'Could not confirm that the change was saved',
      {
        id: 'board-save-unconfirmed',
        description:
          'The board reloads when the server answers. Reload the page to see what was saved now.',
        duration: 8000,
        action: { label: 'Reload page', onClick: reloadPage },
      },
    )
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoard).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'insertColumn' } },
    )
  })

  test('the undo of a card drag: the user is told the save is unconfirmed and the board is fetched again', async () => {
    // Arrange: card-1 was dragged from To Do to Done and that drag was saved;
    // the server never answers the save of the undo
    vi.mocked(batchUpdateRepoCardOrders).mockReturnValueOnce(
      new Promise<never>(() => {}),
    )
    const { wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })

    // Act
    pressUndoKey()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(toast.warning).toHaveBeenCalledWith(
      'Could not confirm that the change was saved',
      {
        id: 'board-save-unconfirmed',
        description:
          'The board reloads when the server answers. Reload the page to see what was saved now.',
        duration: 8000,
        action: { label: 'Reload page', onClick: reloadPage },
      },
    )
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoard).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'undoCardPositions' } },
    )
  })

  test('the undo of a column drag: the user is told the save is unconfirmed and the board is fetched again', async () => {
    // Arrange: To Do and Done were swapped and that swap was saved; the
    // server never answers the save of the undo
    vi.mocked(batchUpdateStatusListPositions).mockReturnValueOnce(
      new Promise<never>(() => {}),
    )
    const { wrapper } = createBoardStore(
      [],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })
    await act(async () => {
      await result.current.handleDragEnd(
        dropColumnOnColumn('status-todo', 'status-done'),
      )
    })

    // Act
    pressUndoKey()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(toast.warning).toHaveBeenCalledWith(
      'Could not confirm that the change was saved',
      {
        id: 'board-save-unconfirmed',
        description:
          'The board reloads when the server answers. Reload the page to see what was saved now.',
        duration: 8000,
        action: { label: 'Reload page', onClick: reloadPage },
      },
    )
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoard).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'undoColumnPositions' } },
    )
  })

  test('a card removed from the board stays off the screen, the user is told the save is unconfirmed and the board is fetched again', async () => {
    // Arrange
    const { store, wrapper } = createBoardStore(
      [
        makeCard('card-1', 'gitbox', 'status-todo', 0),
        makeCard('card-2', 'corelive', 'status-todo', 1),
      ],
      [makeColumn('status-todo', 'To Do', 0)],
    )
    const { result } = renderHook(() => useOptimisticCardAction(), { wrapper })

    // Act: the server never answers the removal
    act(() => {
      void result.current(
        toRepoCardId('card-1'),
        async () => new Promise<never>(() => {}),
        { actionName: 'removeFromBoard', errorMessage: 'Failed to remove' },
      )
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(toast.warning).toHaveBeenCalledWith(
      'Could not confirm that the change was saved',
      {
        id: 'board-save-unconfirmed',
        description:
          'The board reloads when the server answers. Reload the page to see what was saved now.',
        duration: 8000,
        action: { label: 'Reload page', onClick: reloadPage },
      },
    )
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoard).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'removeFromBoard' } },
    )
    expect(store.getState().board.repoCards).toEqual([
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ])
  })

  test('a save answered one millisecond before the limit says nothing and fetches nothing', async () => {
    // Arrange
    const { finishSave, pendingSave } = holdSuccessfulSaveOpen()
    vi.mocked(updateRepoCardPosition).mockReturnValueOnce(pendingSave)
    const { wrapper } = createBoardStore(
      [makeCard('card-1', 'gitbox', 'status-todo', 0)],
      [
        makeColumn('status-todo', 'To Do', 0),
        makeColumn('status-done', 'Done', 1),
      ],
    )
    const { result } = renderHook(() => useBoardDragAndUndo(), { wrapper })

    // Act
    let drag: Promise<void> = Promise.resolve()
    act(() => {
      drag = result.current.handleDragEnd(
        dropCardOnColumn('card-1', 'status-done'),
      )
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_999)
      finishSave()
      await drag
      await vi.advanceTimersByTimeAsync(60_000)
    })

    // Assert
    expect(toast.warning).not.toHaveBeenCalled()
    expect(readBoard).not.toHaveBeenCalled()
    expect(readBoardOutsideTheQueue).not.toHaveBeenCalled()
  })
})
