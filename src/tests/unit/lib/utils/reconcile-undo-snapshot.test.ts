/**
 * Unit Tests: undo after a drag never resurrects a card that left the board
 *
 * A snapshot is taken before a drag and replayed when the user presses Z. In
 * between, a card can be moved to another board, sent to Maintenance, removed
 * or added. Replaying the raw snapshot would show a card that is gone and
 * write its old column back to the database.
 *
 * @see src/lib/utils/reconcile-undo-snapshot.ts
 */

import { describe, test, expect } from 'vitest'

import type { RepoCardForRedux } from '@/lib/models/domain'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'
import { reconcileUndoSnapshot } from '@/lib/utils/reconcile-undo-snapshot'

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

describe('reconcileUndoSnapshot', () => {
  test('a card moved to another board after the drag is neither shown again nor written back', () => {
    // Arrange
    const snapshotBeforeDrag = [
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ]
    // card-1 was dragged to Done, then card-2 was moved to another board
    const cardsOnBoardNow = [makeCard('card-1', 'gitbox', 'status-done', 0)]

    // Act
    const result = reconcileUndoSnapshot(snapshotBeforeDrag, cardsOnBoardNow)

    // Assert
    expect(result.cards.map((card) => card.id)).toEqual(['card-1'])
    expect(result.restored.map((card) => card.id)).toEqual(['card-1'])
    expect(result.restored[0]).toMatchObject({
      statusId: 'status-todo',
      order: 0,
    })
  })

  test('a card added after the drag stays where it is', () => {
    // Arrange
    const snapshotBeforeDrag = [makeCard('card-1', 'gitbox', 'status-todo', 0)]
    // card-1 was dragged to Done, then card-3 was added to Done below it
    const cardsOnBoardNow = [
      makeCard('card-1', 'gitbox', 'status-done', 0),
      makeCard('card-3', 'new-project', 'status-done', 1),
    ]

    // Act
    const result = reconcileUndoSnapshot(snapshotBeforeDrag, cardsOnBoardNow)

    // Assert
    expect(result.cards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-3', 'new-project', 'status-done', 1),
    ])
    // Only the card that was on the board before the drag is written back
    expect(result.restored).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
    ])
  })

  test('every card goes back to its old column and order when the board did not change', () => {
    // Arrange
    const snapshotBeforeDrag = [
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ]
    // card-1 was dragged to Done, which moved card-2 up
    const cardsOnBoardNow = [
      makeCard('card-2', 'corelive', 'status-todo', 0),
      makeCard('card-1', 'gitbox', 'status-done', 0),
    ]

    // Act
    const result = reconcileUndoSnapshot(snapshotBeforeDrag, cardsOnBoardNow)

    // Assert
    expect(result.cards).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ])
    expect(result.restored).toEqual([
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ])
  })
})
