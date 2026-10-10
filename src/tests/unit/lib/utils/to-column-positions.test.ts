/**
 * Unit Tests: card positions are read from the order cards are shown in
 *
 * Drags reorder the cards array and never update a card's own `order` field,
 * so that field is stale after the first drag. Writing it back (as undo once
 * did) saved an order to the database that differed from the screen.
 *
 * @see src/lib/utils/to-column-positions.ts
 */

import { describe, test, expect } from 'vitest'

import type { RepoCardForRedux } from '@/lib/models/domain'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'
import { toColumnPositions } from '@/lib/utils/to-column-positions'

/** A card of board-1 for `laststance/<repoName>` in the given column, with a possibly stale `order`. */
function makeCard(
  id: string,
  repoName: string,
  statusId: string,
  staleOrder: number,
): RepoCardForRedux {
  return {
    id: toRepoCardId(id),
    title: `laststance/${repoName}`,
    statusId: toStatusListId(statusId),
    boardId: toBoardId('board-1'),
    repoOwner: 'laststance',
    repoName,
    order: staleOrder,
    meta: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('toColumnPositions', () => {
  test('numbers cards by where they are shown, not by their stale order field', () => {
    // Arrange: card-3 was dragged to the top; its own order field still says 2
    const cardsAsShown = [
      makeCard('card-3', 'nsx', 'status-todo', 2),
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-todo', 1),
    ]

    // Act
    const positions = toColumnPositions(cardsAsShown)

    // Assert
    expect(positions).toEqual([
      { id: 'card-3', statusId: 'status-todo', order: 0 },
      { id: 'card-1', statusId: 'status-todo', order: 1 },
      { id: 'card-2', statusId: 'status-todo', order: 2 },
    ])
  })

  test('numbers each column on its own when columns are interleaved', () => {
    // Arrange
    const cardsAsShown = [
      makeCard('card-1', 'gitbox', 'status-todo', 0),
      makeCard('card-2', 'corelive', 'status-done', 0),
      makeCard('card-3', 'nsx', 'status-todo', 0),
    ]

    // Act
    const positions = toColumnPositions(cardsAsShown)

    // Assert
    expect(positions).toEqual([
      { id: 'card-1', statusId: 'status-todo', order: 0 },
      { id: 'card-2', statusId: 'status-done', order: 0 },
      { id: 'card-3', statusId: 'status-todo', order: 1 },
    ])
  })
})
