/**
 * Unit Tests: when board data from the server may replace the board on screen
 *
 * The board page puts the server's cards and columns into the store, and
 * fetches them again after a failed save left the store out of step. Data
 * that was fetched before a drag was saved does not contain that drag. Putting
 * it into the store moved the card back on screen while the database kept the
 * new place, and the board stayed wrong until reload.
 *
 * Each test drives the real store. "The server answers" is a re-render with
 * new page data, which is how router.refresh() delivers it.
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
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import boardReducer, { setRepoCards } from '@/lib/redux/slices/boardSlice'
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

const fetchBoardAgain = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: fetchBoardAgain }),
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

/** The page data of one board: what the server component hands the client. */
interface PageData {
  boardId: BoardId
  statusLists: StatusListDomain[]
  repoCards: RepoCardForRedux[]
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()
  })

  test('shows the server copy of the board after a fetch that nothing interrupted', () => {
    // Arrange: the board is open and a failed save asks for a fresh copy
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    act(() => {
      store.dispatch(boardRefreshRequested())
    })

    // Act: the server answers with the card in Done
    rerender(makePageData('status-done'))

    // Assert
    expect(fetchBoardAgain).toHaveBeenCalledTimes(1)
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
  })

  test('keeps a card dragged while the board was being fetched, then fetches again once the drag is saved', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    // The user drags the card to Done; its save is still pending
    const { finishSave, pendingSave } = holdSaveOpen()
    let dragSave = Promise.resolve()
    act(() => {
      store.dispatch(setRepoCards([makeCard('status-done')]))
      dragSave = trackBoardWrite(store.dispatch, pendingSave)
    })

    // Act: the fetch answers with the card still in To Do
    rerender(makePageData('status-todo'))

    // Assert: the drag stays on screen and no second fetch races the save
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(fetchBoardAgain).toHaveBeenCalledTimes(1)

    // Act: the save lands
    await act(async () => {
      finishSave()
      await dragSave
    })

    // Assert: now the board is fetched again
    expect(fetchBoardAgain).toHaveBeenCalledTimes(2)

    // Act: that fetch answers with the saved place
    rerender(makePageData('status-done'))

    // Assert
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(fetchBoardAgain).toHaveBeenCalledTimes(2)
  })

  test('drops a fetch that began before a drag, even when the drag is already saved when it answers', async () => {
    // Arrange: a fetch is on its way
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    act(() => {
      store.dispatch(boardRefreshRequested())
    })
    // The user drags the card to Done and the save finishes at once
    await act(async () => {
      store.dispatch(setRepoCards([makeCard('status-done')]))
      await trackBoardWrite(store.dispatch, Promise.resolve())
    })

    // Act: the earlier fetch answers with the card still in To Do
    rerender(makePageData('status-todo'))

    // Assert: the drag stays on screen and the board is fetched once more
    expect(store.getState().board.repoCards).toEqual([makeCard('status-done')])
    expect(fetchBoardAgain).toHaveBeenCalledTimes(2)
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()
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
      store.dispatch(setRepoCards([makeCard('status-done')]))
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
    expect(fetchBoardAgain).toHaveBeenCalledTimes(2)
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()

    // Act
    await act(async () => {
      finishSave()
      await dragSave
    })

    // Assert
    expect(fetchBoardAgain).toHaveBeenCalledTimes(1)
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
    expect(fetchBoardAgain).toHaveBeenCalledTimes(1)
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith("You're offline", {
      id: 'board-refresh-offline',
      description: 'The board reloads when the connection is back.',
      duration: Infinity,
    })
    expect(toast.dismiss).not.toHaveBeenCalled()

    // Act
    act(() => {
      setBrowserOnline(true)
    })

    // Assert: the notice is taken down and the board is fetched
    expect(toast.dismiss).toHaveBeenCalledWith('board-refresh-offline')
    expect(fetchBoardAgain).toHaveBeenCalledTimes(1)
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
      store.dispatch(setRepoCards([makeCard('status-done')]))
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()

    // Act
    await act(async () => {
      finishSave()
      await dragSave
    })

    // Assert: with the save in the database, the board is fetched again
    expect(fetchBoardAgain).toHaveBeenCalledTimes(1)
  })

  test('shows another board at once even while a save of the previous board is pending', () => {
    // Arrange: board-1 is open and a drag on it is still saving
    const { store, wrapper } = createAppStore()
    const { rerender } = renderHook(
      (pageData: PageData) => useBoardServerSync(pageData),
      { wrapper, initialProps: makePageData('status-todo') },
    )
    act(() => {
      store.dispatch(setRepoCards([makeCard('status-done')]))
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()
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
      store.dispatch(setRepoCards([makeCard('status-done')]))
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()

    // Act: the save lands
    await act(async () => {
      finishSave()
      await dragSave
    })

    // Assert: the board is fetched again, so the saved place shows up
    expect(fetchBoardAgain).toHaveBeenCalledTimes(1)
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()
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
    expect(fetchBoardAgain).not.toHaveBeenCalled()

    // Act
    await act(async () => {
      secondDrag.finishSave()
      await secondDragSave
    })

    // Assert
    expect(fetchBoardAgain).toHaveBeenCalledTimes(1)
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
      store.dispatch(setRepoCards([makeCard('status-done')]))
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
    expect(fetchBoardAgain).toHaveBeenCalledTimes(2)
  })
})
