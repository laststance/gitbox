/**
 * Unit Tests: removeMovedRepoCard() and trackBoardWrite()
 *
 * A card that was moved to another board leaves the board in the store when
 * the server answers. The answer of a slow move can arrive after the user
 * opened a different board; these tests pin that the card is then left alone,
 * so it does not vanish from the board it was just moved to.
 *
 * A save on its way holds back board data fetched meanwhile, because that
 * data may not contain the save yet. The hold has an end: a save that gets no
 * answer would otherwise keep the board from ever being fetched again. At
 * that end nobody knows whether the save landed, so the board is fetched
 * again and the caller is told.
 *
 * @see src/lib/redux/slices/boardSyncSlice.ts
 */

import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, test, vi } from 'vitest'

import type { RepoCardForRedux } from '@/lib/models/domain'
import boardReducer, {
  removeStatusListWithCards,
  selectRepoCards,
  setRepoCards,
} from '@/lib/redux/slices/boardSlice'
import boardSyncReducer, {
  boardRefreshSent,
  removeMovedRepoCard,
  selectIsBoardRefreshDue,
  selectMayApplyServerSnapshot,
  serverSnapshotApplied,
  trackBoardWrite,
} from '@/lib/redux/slices/boardSyncSlice'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

/**
 * A card of `laststance/<repoName>` on the given board.
 * @param cardId - Id of the card.
 * @param boardId - Board the card sits on.
 * @param repoName - Repository name.
 * @returns The card as the store holds it.
 */
function makeCard(
  cardId: string,
  boardId: string,
  repoName: string,
): RepoCardForRedux {
  return {
    id: toRepoCardId(cardId),
    title: `laststance/${repoName}`,
    description: '',
    statusId: toStatusListId(`${boardId}-status-1`),
    boardId: toBoardId(boardId),
    repoOwner: 'laststance',
    repoName,
    order: 0,
    meta: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

/**
 * A store that holds the server data of one board.
 * @param boardId - Board whose cards are in the store.
 * @param cards - Those cards.
 * @returns The store.
 */
function createStoreHoldingBoard(boardId: string, cards: RepoCardForRedux[]) {
  const store = configureStore({
    reducer: { board: boardReducer, boardSync: boardSyncReducer },
  })
  store.dispatch(setRepoCards(cards))
  store.dispatch(serverSnapshotApplied(toBoardId(boardId)))
  return store
}

describe('removeMovedRepoCard()', () => {
  test('takes a moved card off the board it was moved from', () => {
    // Arrange
    const store = createStoreHoldingBoard('board-1', [
      makeCard('card-1', 'board-1', 'gitbox'),
      makeCard('card-2', 'board-1', 'docs'),
    ])

    // Act
    store.dispatch(
      removeMovedRepoCard(toBoardId('board-1'), toRepoCardId('card-1')),
    )

    // Assert
    expect(selectRepoCards(store.getState()).map((card) => card.id)).toEqual([
      'card-2',
    ])
  })

  test('leaves the cards of another board in place when the move is answered after that board was opened', () => {
    // Arrange: the user opened the destination board before the answer came,
    // and that board already shows the moved card
    const store = createStoreHoldingBoard('board-2', [
      makeCard('card-1', 'board-2', 'gitbox'),
      makeCard('card-3', 'board-2', 'website'),
    ])

    // Act: the answer of the move away from board-1 arrives now
    store.dispatch(
      removeMovedRepoCard(toBoardId('board-1'), toRepoCardId('card-1')),
    )

    // Assert
    expect(selectRepoCards(store.getState()).map((card) => card.id)).toEqual([
      'card-1',
      'card-3',
    ])
  })
})

describe('trackBoardWrite()', () => {
  afterEach(() => {
    // Most tests here let 15 seconds pass on fake timers
    vi.useRealTimers()
  })

  test('holds back board data fetched while a save is on its way, and lets it in once the server answered', async () => {
    // Arrange
    const store = createStoreHoldingBoard('board-1', [])
    let answerSave: () => void = () => {}
    const save = new Promise<void>((resolve) => {
      answerSave = resolve
    })

    // Act
    const trackedSave = trackBoardWrite(store.dispatch, save)
    const mayApplyBoardDataWhileSaving = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    answerSave()
    await trackedSave

    // Assert
    expect(mayApplyBoardDataWhileSaving).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
    // An answer in time is no reason to fetch the board
    expect(store.getState().boardSync.isRefreshWanted).toBe(false)
  })

  test('stops holding back board data after 15 seconds without an answer, so a save that never settles cannot freeze the board', async () => {
    // Arrange: a save the server never answers
    vi.useFakeTimers()
    const store = createStoreHoldingBoard('board-1', [])
    void trackBoardWrite(store.dispatch, new Promise<void>(() => {}))

    // Act
    await vi.advanceTimersByTimeAsync(14_999)
    const mayApplyBoardDataJustBeforeTheLimit = selectMayApplyServerSnapshot(
      store.getState(),
      toBoardId('board-1'),
    )
    await vi.advanceTimersByTimeAsync(1)

    // Assert
    expect(mayApplyBoardDataJustBeforeTheLimit).toBe(false)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(true)
    expect(store.getState().boardSync.pendingWriteCount).toBe(0)
  })

  test('has the board fetched again when 15 seconds pass without an answer, because the board may show a change that was not saved', async () => {
    // Arrange: a save the server never answers; nothing else asked for a fetch
    vi.useFakeTimers()
    const store = createStoreHoldingBoard('board-1', [])
    void trackBoardWrite(store.dispatch, new Promise<void>(() => {}))

    // Act
    await vi.advanceTimersByTimeAsync(14_999)
    const isRefreshDueJustBeforeTheLimit = selectIsBoardRefreshDue(
      store.getState(),
    )
    await vi.advanceTimersByTimeAsync(1)

    // Assert
    expect(isRefreshDueJustBeforeTheLimit).toBe(false)
    expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
  })

  test('tells its caller once that a save got no answer, at the 15 seconds and not again when the answer comes late', async () => {
    // Arrange: a save that is answered after 20 seconds
    vi.useFakeTimers()
    const store = createStoreHoldingBoard('board-1', [])
    const tellTheUser = vi.fn()
    let answerSave: () => void = () => {}
    const lateSave = new Promise<void>((resolve) => {
      answerSave = resolve
    })
    const trackedSave = trackBoardWrite(store.dispatch, lateSave, tellTheUser)

    // Act
    await vi.advanceTimersByTimeAsync(14_999)
    const callsJustBeforeTheLimit = tellTheUser.mock.calls.length
    await vi.advanceTimersByTimeAsync(1)
    const callsAtTheLimit = tellTheUser.mock.calls.length
    await vi.advanceTimersByTimeAsync(5_000)
    answerSave()
    await trackedSave

    // Assert
    expect(callsJustBeforeTheLimit).toBe(0)
    expect(callsAtTheLimit).toBe(1)
    expect(tellTheUser).toHaveBeenCalledTimes(1)
  })

  test('tells its caller nothing about a save that is answered in time', async () => {
    // Arrange: a save answered after 14.999 seconds
    vi.useFakeTimers()
    const store = createStoreHoldingBoard('board-1', [])
    const tellTheUser = vi.fn()
    let answerSave: () => void = () => {}
    const save = new Promise<void>((resolve) => {
      answerSave = resolve
    })
    const trackedSave = trackBoardWrite(store.dispatch, save, tellTheUser)
    await vi.advanceTimersByTimeAsync(14_999)

    // Act
    answerSave()
    await trackedSave
    await vi.advanceTimersByTimeAsync(60_000)

    // Assert
    expect(tellTheUser).not.toHaveBeenCalled()
    expect(store.getState().boardSync.isRefreshWanted).toBe(false)
  })

  test('has the board fetched once more when the answer arrives after the 15 seconds, because the fetch sent at the limit may lack the save', async () => {
    // Arrange: a save that is answered late. At the limit the board was
    // fetched again, and that copy is in the store by now.
    vi.useFakeTimers()
    const store = createStoreHoldingBoard('board-1', [])
    let answerSave: () => void = () => {}
    const lateSave = new Promise<void>((resolve) => {
      answerSave = resolve
    })
    const trackedSave = trackBoardWrite(store.dispatch, lateSave)
    await vi.advanceTimersByTimeAsync(15_000)
    store.dispatch(boardRefreshSent())
    store.dispatch(serverSnapshotApplied(toBoardId('board-1')))
    const isRefreshWantedBeforeTheAnswer =
      store.getState().boardSync.isRefreshWanted

    // Act
    answerSave()
    await trackedSave

    // Assert
    expect(isRefreshWantedBeforeTheAnswer).toBe(false)
    expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
  })

  test('counts a late save out once only, so a second save that is still on its way keeps holding fetches back', async () => {
    // Arrange: the first save is 15 seconds old and gets its answer now; the
    // second one was sent 10 seconds after it and has no answer yet
    vi.useFakeTimers()
    const store = createStoreHoldingBoard('board-1', [])
    let answerFirstSave: () => void = () => {}
    const firstSave = new Promise<void>((resolve) => {
      answerFirstSave = resolve
    })
    const trackedFirstSave = trackBoardWrite(store.dispatch, firstSave)
    await vi.advanceTimersByTimeAsync(10_000)
    void trackBoardWrite(store.dispatch, new Promise<void>(() => {}))
    await vi.advanceTimersByTimeAsync(5_000)

    // Act
    answerFirstSave()
    await trackedFirstSave

    // Assert
    expect(store.getState().boardSync.pendingWriteCount).toBe(1)
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(false)
  })

  test('hands a refused save to the code that rolls the board back, also when the refusal arrives late', async () => {
    // Arrange
    vi.useFakeTimers()
    const store = createStoreHoldingBoard('board-1', [])
    let refuseSave: (reason: Error) => void = () => {}
    const refusedSave = new Promise<void>((_resolve, reject) => {
      refuseSave = reject
    })
    const trackedSave = trackBoardWrite(store.dispatch, refusedSave)
    const refusal = expect(trackedSave).rejects.toThrow('Failed to save')
    await vi.advanceTimersByTimeAsync(15_000)

    // Act
    refuseSave(new Error('Failed to save'))

    // Assert
    await refusal
    expect(store.getState().boardSync.pendingWriteCount).toBe(0)
  })
})

describe('board data fetched before a column was deleted', () => {
  // Value: protects=a column deleted while the board was being fetched stays deleted, with its cards (Codex adversarial review of #216); fails_when=removeStatusListWithCards is left out of the change count, so the older fetch puts the column and its cards back and the picker hides their repositories as on this board; why_new=the action is new in #216 and replaced setStatusLists, which was counted; seam=none; no_claim=the timing of a real fetch (useBoardServerSync)
  test('is dropped when it arrives after the column and its cards were deleted', () => {
    // Arrange: a fetch goes out while the board holds a card in its column
    const store = createStoreHoldingBoard('board-1', [
      makeCard('card-1', 'board-1', 'gitbox'),
    ])
    store.dispatch(boardRefreshSent())

    // Act: the column is deleted before the fetch comes back
    store.dispatch(
      removeStatusListWithCards(toStatusListId('board-1-status-1')),
    )

    // Assert
    expect(selectRepoCards(store.getState())).toEqual([])
    expect(
      selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
    ).toBe(false)
  })
})
