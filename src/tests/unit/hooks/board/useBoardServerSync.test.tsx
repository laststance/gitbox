/**
 * Unit Tests: when board data from the server may replace the board on screen
 *
 * The board page puts the server's cards and columns into the store, and
 * fetches them again after a failed save left the store out of step. Data
 * that was fetched before a drag was saved does not contain that drag. Putting
 * it into the store moved the card back on screen while the database kept the
 * new place, and the board stayed wrong until reload.
 *
 * Each test drives the real store. A refetch is {@link getBoardBundle}. The
 * test holds that promise and resolves it when "the server answers". Page
 * data that arrives on its own is still a re-render: that is a navigation,
 * not a refetch.
 *
 * @see src/hooks/board/useBoardServerSync.ts
 */

import { configureStore } from '@reduxjs/toolkit'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useBoardServerSync } from '@/hooks/board/useBoardServerSync'
import type { BoardBundle } from '@/lib/actions/mappers'
import type { CommentData } from '@/lib/actions/project-info-core'
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import boardReducer, * as boardSliceModule from '@/lib/redux/slices/boardSlice'
import boardSyncReducer, {
  boardRefreshRequested,
  trackBoardWrite,
} from '@/lib/redux/slices/boardSyncSlice'
import {
  toBoardId,
  toRepoCardId,
  toStatusListId,
  type BoardId,
} from '@/lib/types/brands'
import type { FetchedBoardDetails } from '@/lib/utils/adopt-fetched-board-details'

const { readBoard, readBoardOutsideTheQueue } = vi.hoisted(() => ({
  readBoard: vi.fn(),
  readBoardOutsideTheQueue: vi.fn(),
}))

vi.mock('@/lib/actions/board-data', () => ({
  getBoardBundle: readBoard,
}))

vi.mock('@/lib/fetch-board-bundle', () => ({
  fetchBoardBundle: readBoardOutsideTheQueue,
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

/** A refetch the test answers on demand. */
interface HeldFetch {
  /** Resolves the refetch with a bundle, or `null` when the board is gone. */
  resolve: (bundle: BoardBundle | null) => void
  /** Rejects the refetch. */
  reject: (error: unknown) => void
}

/** Refetches that have been sent and not answered, oldest first. */
const heldFetches: HeldFetch[] = []

/**
 * Holds a refetch until the test answers it.
 *
 * @returns A promise that settles when {@link answerFetch} or {@link failFetch} runs.
 */
async function holdFetch(): Promise<BoardBundle | null> {
  return new Promise((resolve, reject) => {
    heldFetches.push({ resolve, reject })
  })
}

/**
 * Answers the oldest refetch that is still waiting.
 *
 * @param page - Columns and cards the answer carries.
 * @param details - Name, subtitle, settings and comments the answer carries.
 */
function answerFetch(page: PageData, details?: FetchDetails): void {
  const held = heldFetches.shift()
  if (held === undefined) throw new Error('No board fetch is waiting')
  held.resolve({
    board: {
      id: page.boardId,
      name: details?.name ?? 'Test Board',
      subtitle: details?.subtitle ?? null,
      settings: details?.settings ?? null,
    },
    statusLists: page.statusLists,
    repoCards: page.repoCards,
    comments: details?.comments ?? {},
  } as unknown as BoardBundle)
}

/**
 * Answers the oldest refetch with no board to show.
 */
function answerThatTheBoardIsGone(): void {
  const held = heldFetches.shift()
  if (held === undefined) throw new Error('No board fetch is waiting')
  held.resolve(null)
}

/**
 * Fails the oldest refetch that is still waiting.
 *
 * @param error - What the read rejects with.
 */
function failFetch(error: unknown): void {
  const held = heldFetches.shift()
  if (held === undefined) throw new Error('No board fetch is waiting')
  held.reject(error)
}

/** The page data of one board: what the server component hands the client. */
interface PageData {
  boardId: BoardId
  statusLists: StatusListDomain[]
  repoCards: RepoCardForRedux[]
  /** Receives the name and the comments when a refetch is applied. */
  onAppliedDetails?: (details: FetchedBoardDetails) => void
}

/** Name, subtitle, settings and comments carried by one answered refetch. */
interface FetchDetails {
  name: string
  subtitle: string | null
  settings: unknown
  comments: Record<string, CommentData>
}

/** A card for `laststance/gitbox` in the given column of the given board. */
function makeCard(statusId: string, boardId = 'board-1'): RepoCardForRedux {
  return {
    id: toRepoCardId('card-1'),
    title: 'laststance/gitbox',
    statusId: toStatusListId(statusId),
    boardId: toBoardId(boardId),
    repoOwner: 'laststance',
    repoName: 'gitbox',
    order: 0,
    meta: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** The "To Do" and "Done" columns of the given board. */
function makeColumns(boardId = 'board-1'): StatusListDomain[] {
  return [
    {
      id: toStatusListId('status-todo'),
      title: 'To Do',
      color: '#6B7280',
      gridRow: 0,
      gridCol: 0,
      boardId: toBoardId(boardId),
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: toStatusListId('status-done'),
      title: 'Done',
      color: '#6B7280',
      gridRow: 0,
      gridCol: 1,
      boardId: toBoardId(boardId),
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ]
}

/** Page data of board-1 with its one card in the given column. */
function makePageData(cardStatusId: string): PageData {
  return {
    boardId: toBoardId('board-1'),
    statusLists: makeColumns(),
    repoCards: [makeCard(cardStatusId)],
  }
}

/** An empty app store, and the provider that hands it to the hook. */
function createAppStore() {
  const store = configureStore({
    reducer: { board: boardReducer, boardSync: boardSyncReducer },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  return { store, wrapper }
}

/** A save the test finishes on demand, so the server can answer while it is pending. */
function holdSaveOpen(): {
  finishSave: () => void
  pendingSave: Promise<void>
} {
  let finishSave = (): void => undefined
  const pendingSave = new Promise<void>((resolve) => {
    finishSave = resolve
  })
  return { finishSave, pendingSave }
}

/** Make the browser report that it is online or offline, and announce the change. */
function setBrowserOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline)
  window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'))
}

describe('board data from the server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    heldFetches.length = 0
    readBoard.mockImplementation(holdFetch)
    readBoardOutsideTheQueue.mockImplementation(holdFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows the cards and columns the server sent when the board opens', () => {
    // Arrange
    const { store, wrapper } = createAppStore()

    // Act
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([makeCard('status-todo')])
    expect(store.getState().board.statusLists).toEqual(makeColumns())
    expect(readBoard).not.toHaveBeenCalled()
  })

  test('shows the server copy of the board after a fetch that nothing interrupted', async () => {
    // Arrange: the board is open and a failed save asks for a fresh copy
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })

    // Act: the server answers with the card in Done
    await act(async () => {
      answerFetch(makePageData('status-done'))
    })

    // Assert
    expect(readBoard).toHaveBeenCalledTimes(1)
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
  })

  // Value: protects=a refetch shows the name, subtitle, settings and comments it read (TODOS.md board settings refetch); fails_when=the page is told only about the columns and cards; why_new=those four used to be dropped; seam=none; no_claim=the header rendering (useBoardSettings.test.ts)
  test('hands the fetched name, subtitle, settings and comments to the page', async () => {
    // Arrange
    const onAppliedDetails = vi.fn()
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: { ...makePageData('status-todo'), onAppliedDetails },
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })

    // Act
    await act(async () => {
      answerFetch(makePageData('status-done'), {
        name: 'Renamed elsewhere',
        subtitle: 'from the other tab',
        settings: { showSubtitle: false },
        comments: {
          'card-1': { comment: 'shipped', color: 'blue' },
        },
      })
    })

    // Assert
    expect(onAppliedDetails).toHaveBeenCalledTimes(1)
    expect(onAppliedDetails).toHaveBeenCalledWith({
      boardId: toBoardId('board-1'),
      name: 'Renamed elsewhere',
      subtitle: 'from the other tab',
      settings: { showSubtitle: false },
      comments: {
        'card-1': { comment: 'shipped', color: 'blue' },
      },
    })
  })

  // Value: protects=a name read before a drag was saved is not shown over the board (TODOS.md board settings refetch); fails_when=the dropped fetch still hands its name to the page; why_new=the name rides along with the cards, which this fetch must not replace; seam=none; no_claim=the header (useBoardSettings.test.ts)
  test('does not hand over a name read before a drag was saved', async () => {
    // Arrange: a fetch is on its way
    const onAppliedDetails = vi.fn()
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: { ...makePageData('status-todo'), onAppliedDetails },
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    // The user drags the card to Done and the save finishes at once
    await act(async () => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      await trackBoardWrite(store.dispatch, Promise.resolve())
    })

    // Act: the earlier fetch answers with a name from before the drag
    await act(async () => {
      answerFetch(makePageData('status-todo'), {
        name: 'Read too early',
        subtitle: null,
        settings: null,
        comments: {},
      })
    })

    // Assert
    expect(onAppliedDetails).not.toHaveBeenCalled()
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
  })

  test('keeps a card dragged while the board was being fetched, then fetches again once the drag is saved', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    // The user drags the card to Done; its save is still pending
    const { finishSave, pendingSave } = holdSaveOpen()
    let dragSave = Promise.resolve()
    act(() => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      dragSave = trackBoardWrite(store.dispatch, pendingSave)
    })

    // Act: the fetch answers with the card still in To Do
    await act(async () => {
      answerFetch(makePageData('status-todo'))
    })

    // Assert: the drag stays on screen and no second fetch races the save
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).toHaveBeenCalledTimes(1)

    // Act: the save lands
    await act(async () => {
      finishSave()
      await dragSave
    })

    // Assert: now the board is fetched again
    expect(readBoard).toHaveBeenCalledTimes(2)

    // Act: that fetch answers with the saved place
    await act(async () => {
      answerFetch(makePageData('status-done'))
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('drops a fetch that began before a drag, even when the drag is already saved when it answers', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    // The user drags the card to Done and the save finishes at once
    await act(async () => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      await trackBoardWrite(store.dispatch, Promise.resolve())
    })

    // Act: the earlier fetch answers with the card still in To Do
    await act(async () => {
      answerFetch(makePageData('status-todo'))
    })

    // Assert: the drag stays on screen and the board is fetched once more
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('drops a fetch that began before the columns were replaced', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    const renamedColumns = makeColumns().map((column) =>
      column.id === toStatusListId('status-done')
        ? { ...column, title: 'Shipped' }
        : column,
    )
    act(() => {
      store.dispatch(boardSliceModule.setStatusLists(renamedColumns))
    })

    // Act: the earlier fetch answers with the old column title
    await act(async () => {
      answerFetch(makePageData('status-todo'))
    })

    // Assert: the rename stays, and the board is fetched once more
    expect(store.getState().board.statusLists).toEqual(renamedColumns)
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('drops a fetch that began before a card was added', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    const addedCard = {
      ...makeCard('status-todo'),
      id: toRepoCardId('card-2'),
      title: 'laststance/corelive',
      repoName: 'corelive',
    }
    act(() => {
      store.dispatch(boardSliceModule.addRepoCards([addedCard]))
    })

    // Act: the earlier fetch answers with only the original card
    await act(async () => {
      answerFetch(makePageData('status-todo'))
    })

    // Assert: the added card stays, and the board is fetched once more
    expect(store.getState().board.repoCards).toEqual([
      makeCard('status-todo'),
      addedCard,
    ])
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('drops a fetch that began before a card was removed', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    act(() => {
      store.dispatch(boardSliceModule.removeRepoCard(toRepoCardId('card-1')))
    })

    // Act: the earlier fetch answers with the card still on the board
    await act(async () => {
      answerFetch(makePageData('status-todo'))
    })

    // Assert: the card stays gone, and the board is fetched once more
    expect(store.getState().board.repoCards).toEqual([])
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('drops a fetch that began before a card GitHub text was refreshed', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    act(() => {
      store.dispatch(
        boardSliceModule.applyRefreshedRepoCards([
          {
            id: 'card-1',
            description: 'fresh from GitHub',
            meta: { stars: 3 },
          },
        ]),
      )
    })

    // Act: the earlier fetch answers with the card before the refresh
    await act(async () => {
      answerFetch(makePageData('status-todo'))
    })

    // Assert: the refreshed text stays, and the board is fetched once more
    expect(store.getState().board.repoCards[0]?.description).toBe(
      'fresh from GitHub',
    )
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('names every board action, so a new one has to be counted or the test changes', () => {
    // Arrange: the reducers that write the columns or the cards
    const boardActions: string[] = []
    for (const value of Object.values(boardSliceModule)) {
      if (
        typeof value === 'function' &&
        'type' in value &&
        typeof value.type === 'string'
      ) {
        boardActions.push(value.type)
      }
    }
    boardActions.sort()

    // Act
    // Assert: a new reducer fails here until it is added to the revision
    // matcher in boardSyncSlice, or named in this list as not writing the board
    expect(boardActions).toEqual([
      'board/addRepoCards',
      'board/applyRefreshedRepoCards',
      'board/removeRepoCard',
      'board/removeStatusListWithCards',
      'board/setRepoCards',
      'board/setStatusLists',
    ])
  })

  test('shows page data that arrives on its own while nothing is being saved', () => {
    // Arrange: the board is open with the card in To Do
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )

    // Act: new page data arrives without a fetch from here (the user came
    // back to the board), showing the card in Done
    rerender(makePageData('status-done'))

    // Assert: it is shown at once, with no extra fetch
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).not.toHaveBeenCalled()
  })

  // Value: protects=the dragged column stays and the board is read again; fails_when=the pre-drag payload is written, or no read is sent; no_claim=Playwright history
  test('keeps a saved drag when the page from before the drag is mounted again', async () => {
    // Arrange: the board is open and the drag has been saved
    const { store, wrapper } = createAppStore()
    const { unmount } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    await act(async () => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      await trackBoardWrite(store.dispatch, Promise.resolve())
    })
    unmount()

    // Act: Back restores the page from before the drag
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })

    // Assert: the drag stays, and the board is read once
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).toHaveBeenCalledTimes(1)

    // Act: that read returns the saved column
    await act(async () => {
      answerFetch(makePageData('status-done'))
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
  })

  // The store outlives the page: a board that is left and opened again is
  // mounted anew, so a copy fetched earlier can reach a hook instance that
  // has never seen the board before.
  test('a refreshed copy that arrives after the page was rebuilt still does not replace a card dragged meanwhile', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    const { unmount } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    // The user drags the card to Done and the save finishes at once
    await act(async () => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      await trackBoardWrite(store.dispatch, Promise.resolve())
    })

    // Act: the page is rebuilt with the copy fetched before the drag
    unmount()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })

    // Assert: the drag stays on screen and the board is fetched once more
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('waits for a pending save before fetching the board again', async () => {
    // Arrange: a save is pending
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    const { finishSave, pendingSave } = holdSaveOpen()
    let dragSave = Promise.resolve()
    act(() => {
      dragSave = trackBoardWrite(store.dispatch, pendingSave)
    })

    // Act: a fresh copy of the board is asked for
    act(() => {
      store.dispatch(boardRefreshRequested())
    })

    // Assert: a fetch now could miss the pending save, so none is sent
    expect(readBoard).not.toHaveBeenCalled()

    // Act
    await act(async () => {
      finishSave()
      await dragSave
    })

    // Assert
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('fetches the board again after a save that was refused', async () => {
    // Arrange: a save is pending and a fresh copy of the board is asked for
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    let refuseSave = (): void => undefined
    const refusedSave = new Promise<void>((_resolve, reject) => {
      refuseSave = (): void => reject(new Error('Save refused'))
    })
    let dragSave = Promise.resolve()
    act(() => {
      dragSave = trackBoardWrite(store.dispatch, refusedSave).catch(
        (): void => undefined,
      )
      store.dispatch(boardRefreshRequested())
    })

    // Act
    await act(async () => {
      refuseSave()
      await dragSave
    })

    // Assert: a refused save no longer holds the fetch back
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('does not fetch the board while offline, says so until the connection is back, then fetches', () => {
    // Arrange: the board is open and the browser goes offline
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      setBrowserOnline(false)
    })

    // Act: a failed save asks for a fresh copy of the board
    act(() => {
      store.dispatch(boardRefreshRequested())
    })

    // Assert: a notice that stays up for as long as the board cannot reload
    expect(readBoard).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith("You're offline", {
      id: 'board-refresh-offline',
      description: 'The board reloads when the connection is back.',
      duration: Infinity,
      closeButton: true,
    })
    expect(toast.dismiss).not.toHaveBeenCalled()

    // Act
    act(() => {
      setBrowserOnline(true)
    })

    // Assert: the notice is taken down and the board is fetched
    expect(toast.dismiss).toHaveBeenCalledWith('board-refresh-offline')
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('keeps the offline notice up while a save is still pending', async () => {
    // Arrange: the board cannot reload, and the notice is up
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    let finishSave = (): void => undefined
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    act(() => {
      setBrowserOnline(false)
      store.dispatch(boardRefreshRequested())
    })
    vi.mocked(toast.dismiss).mockClear()

    // Act: a save starts, so the fetch has to wait
    await act(async () => {
      const saving = trackBoardWrite(store.dispatch, pendingSave)
      finishSave()
      await saving
    })

    // Assert: the notice was not taken down for the save
    expect(toast.dismiss).not.toHaveBeenCalled()
    expect(readBoard).not.toHaveBeenCalled()
  })

  test('keeps a card dragged just before leaving the board when the board is opened again mid-save', async () => {
    // Arrange: the board is open, the user drags the card to Done and leaves
    // while the save is still on its way
    const { store, wrapper } = createAppStore()
    const { unmount } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    const { finishSave, pendingSave } = holdSaveOpen()
    let dragSave = Promise.resolve()
    act(() => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      dragSave = trackBoardWrite(store.dispatch, pendingSave)
    })
    unmount()

    // Act: the board opens again with page data read before the save landed
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })

    // Assert: the drag stays on screen, and no fetch is sent yet
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).not.toHaveBeenCalled()

    // Act
    await act(async () => {
      finishSave()
      await dragSave
    })

    // Assert: with the save in the database, the board is fetched again
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('shows another board at once even while a save of the previous board is pending', () => {
    // Arrange: board-1 is open and a drag on it is still saving
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    act(() => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      void trackBoardWrite(store.dispatch, holdSaveOpen().pendingSave)
    })

    // Act: the user opens board-2
    rerender({
      boardId: toBoardId('board-2'),
      statusLists: makeColumns('board-2'),
      repoCards: [makeCard('status-todo', 'board-2')],
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([
      makeCard('status-todo', 'board-2'),
    ])
    expect(readBoard).not.toHaveBeenCalled()
  })

  test('shows another board at once when the page switches boards', () => {
    // Arrange: board-1 is open
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )

    // Act: the page now shows board-2
    rerender({
      boardId: toBoardId('board-2'),
      statusLists: makeColumns('board-2'),
      repoCards: [makeCard('status-done', 'board-2')],
    })

    // Assert
    expect(store.getState().board.repoCards).toEqual([
      makeCard('status-done', 'board-2'),
    ])
    expect(store.getState().board.statusLists).toEqual(makeColumns('board-2'))
    expect(readBoard).not.toHaveBeenCalled()
  })

  test('fetches a board once more when it was reopened through another board while its save was pending', async () => {
    // Arrange: board-1 is open and a drag of its card to Done is still saving
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    const { finishSave, pendingSave } = holdSaveOpen()
    let dragSave = Promise.resolve()
    act(() => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      dragSave = trackBoardWrite(store.dispatch, pendingSave)
    })

    // Act: the user opens board-2 and comes straight back; board-1's page
    // data was read before the save landed
    rerender({
      boardId: toBoardId('board-2'),
      statusLists: makeColumns('board-2'),
      repoCards: [makeCard('status-todo', 'board-2')],
    })
    rerender(makePageData('status-todo'))

    // Assert: the old copy is all there is to show, and nothing is fetched
    // while the save is still on its way
    expect(store.getState().board.repoCards).toEqual([makeCard('status-todo')])
    expect(readBoard).not.toHaveBeenCalled()

    // Act: the save lands
    await act(async () => {
      finishSave()
      await dragSave
    })

    // Assert: the board is fetched again, so the saved place shows up
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('does not fetch the next board because the previous one was waiting for the connection', () => {
    // Arrange: board-1 is open, offline, and waiting to be fetched again
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    act(() => {
      setBrowserOnline(false)
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })

    // Act: the user opens board-2, then the connection comes back
    rerender({
      boardId: toBoardId('board-2'),
      statusLists: makeColumns('board-2'),
      repoCards: [makeCard('status-todo', 'board-2')],
    })
    act(() => {
      setBrowserOnline(true)
    })

    // Assert: board-2 came fresh from the server, and the notice is gone
    expect(readBoard).not.toHaveBeenCalled()
    expect(toast.dismiss).toHaveBeenCalledWith('board-refresh-offline')
  })

  test('holds the fetch back until every pending save has settled', async () => {
    // Arrange: two drags are saving and a failed save asks for a fresh copy
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    const firstDrag = holdSaveOpen()
    const secondDrag = holdSaveOpen()
    let firstDragSave = Promise.resolve()
    let secondDragSave = Promise.resolve()
    act(() => {
      firstDragSave = trackBoardWrite(store.dispatch, firstDrag.pendingSave)
      secondDragSave = trackBoardWrite(store.dispatch, secondDrag.pendingSave)
      store.dispatch(boardRefreshRequested())
    })

    // Act: only the first save lands
    await act(async () => {
      firstDrag.finishSave()
      await firstDragSave
    })

    // Assert: the second one is still on its way
    expect(readBoard).not.toHaveBeenCalled()

    // Act
    await act(async () => {
      secondDrag.finishSave()
      await secondDragSave
    })

    // Assert
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  // React StrictMode (on in development) runs each effect twice when a
  // component mounts. The first run drops the old copy; the second must not
  // mistake that same copy for fresh page data.
  test('a refreshed copy that arrives after the page was rebuilt does not replace a dragged card under React StrictMode either', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    const { unmount } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      {
        wrapper,
        reactStrictMode: true,
        initialProps: makePageData('status-todo'),
      },
    )
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    // The user drags the card to Done and the save finishes at once
    await act(async () => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      await trackBoardWrite(store.dispatch, Promise.resolve())
    })

    // Act: the page is rebuilt with the copy fetched before the drag
    unmount()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      reactStrictMode: true,
      initialProps: makePageData('status-todo'),
    })

    // Assert: the drag stays on screen and the board is fetched once more
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('drops a fetch that answers after the board was left and opened again', async () => {
    // Arrange: a fetch is on its way, then the card is dragged and the page is rebuilt
    const { store, wrapper } = createAppStore()
    const { unmount } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    await act(async () => {
      store.dispatch(boardSliceModule.setRepoCards([makeCard('status-done')]))
      await trackBoardWrite(store.dispatch, Promise.resolve())
    })
    unmount()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })

    // Act: the fetch from before the rebuild answers with the card in To Do
    await act(async () => {
      answerFetch(makePageData('status-todo'))
    })

    // Assert: the drag stays, and that answer is not the fetch the new page sent
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('reloads the page when the board cannot be shown', async () => {
    // Arrange
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })

    // Act: the read answers that there is no board to show
    await act(async () => {
      answerThatTheBoardIsGone()
    })

    // Assert: reading it again would answer the same way
    expect(toast.error).toHaveBeenCalledWith(
      'The board could not be reloaded',
      expect.objectContaining({
        id: 'board-refresh-failed',
        action: expect.objectContaining({ label: 'Reload page' }) as object,
      }),
    )
    expect(readBoard).toHaveBeenCalledTimes(1)
  })

  test('offers another try when the board could not be reloaded', async () => {
    // Arrange
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested())
    })

    // Act
    await act(async () => {
      failFetch(new Error('The server could not be reached'))
    })

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      'The board could not be reloaded',
      expect.objectContaining({
        id: 'board-refresh-failed',
        action: expect.objectContaining({ label: 'Try again' }) as object,
      }),
    )
    expect(readBoard).toHaveBeenCalledTimes(1)

    // Act: Try again
    const notice = vi.mocked(toast.error).mock.calls[0]?.[1] as
      { action?: { onClick: () => void } } | undefined
    await act(async () => {
      notice?.action?.onClick()
    })

    // Assert
    expect(readBoard).toHaveBeenCalledTimes(2)
  })

  test('tries a route read again through the route', async () => {
    // Arrange: the read that must not wait behind a write fails
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })
    act(() => {
      store.dispatch(boardRefreshRequested({ bypassActionQueue: true }))
    })
    await act(async () => {
      failFetch(new Error('The server could not be reached'))
    })

    // Act
    const notice = vi.mocked(toast.error).mock.calls[0]?.[1] as
      { action?: { onClick: () => void } } | undefined
    await act(async () => {
      notice?.action?.onClick()
    })

    // Assert: the retry does not stand behind the write that has no answer
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(2)
    expect(readBoard).not.toHaveBeenCalled()
  })

  test('reads through the route when the fetch must not wait behind a write', () => {
    // Arrange
    const { store, wrapper } = createAppStore()
    renderHook((pageData: PageData) => useBoardServerSync(pageData), {
      wrapper,
      initialProps: makePageData('status-todo'),
    })

    // Act
    act(() => {
      store.dispatch(boardRefreshRequested({ bypassActionQueue: true }))
    })

    // Assert
    expect(readBoardOutsideTheQueue).toHaveBeenCalledTimes(1)
    expect(readBoardOutsideTheQueue).toHaveBeenCalledWith(toBoardId('board-1'))
    expect(readBoard).not.toHaveBeenCalled()
  })

  test('does not fetch a board that is not the one on screen', () => {
    // Arrange: board-2 is on screen
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    rerender({
      boardId: toBoardId('board-2'),
      statusLists: makeColumns('board-2'),
      repoCards: [makeCard('status-todo', 'board-2')],
    })

    // Act: a save of board-1 asks for board-1
    act(() => {
      store.dispatch(boardRefreshRequested({ boardId: toBoardId('board-1') }))
    })

    // Assert
    expect(readBoard).not.toHaveBeenCalled()

    // Act: board-1 is on screen again
    rerender(makePageData('status-todo'))

    // Assert
    expect(readBoard).toHaveBeenCalledTimes(1)
    expect(readBoard).toHaveBeenCalledWith(toBoardId('board-1'))
  })
})
