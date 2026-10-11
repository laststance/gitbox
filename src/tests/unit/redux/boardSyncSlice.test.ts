/**
 * Unit Tests: removeMovedRepoCard()
 *
 * A card that was moved to another board leaves the board in the store when
 * the server answers. The answer of a slow move can arrive after the user
 * opened a different board; these tests pin that the card is then left alone,
 * so it does not vanish from the board it was just moved to.
 *
 * @see src/lib/redux/slices/boardSyncSlice.ts
 */

import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, test } from 'vitest'

import type { RepoCardForRedux } from '@/lib/models/domain'
import boardReducer, {
  selectRepoCards,
  setRepoCards,
} from '@/lib/redux/slices/boardSlice'
import boardSyncReducer, {
  removeMovedRepoCard,
  serverSnapshotApplied,
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
