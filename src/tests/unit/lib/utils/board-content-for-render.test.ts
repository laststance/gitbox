/**
 * Unit Tests: the first render of a board shows the page's columns
 *
 * The store is empty on the server. Showing it there draws the skeleton
 * even though the page already has the columns.
 *
 * @see src/lib/utils/board-content-for-render.ts
 */

import { describe, expect, test } from 'vitest'

import { boardContentForRender } from '@/lib/utils/board-content-for-render'

const pageColumns = ['Ideas']
const pageCards = ['gitbox']
const storeColumns = ['In progress']
const storeCards = ['other']

describe('boardContentForRender', () => {
  // Value: protects=the server HTML is the board the page already loaded (TODOS.md server render); fails_when=an empty store hides those columns behind the skeleton; why_new=the first render read the store only; seam=none; no_claim=the hydration of the column markup (kanban-board-first-render.test.tsx)
  test('the page columns are shown while the store holds no board', () => {
    // Arrange
    const input = {
      boardId: 'board-1',
      hydratedBoardId: null,
      storeColumns: [] as string[],
      storeCards: [] as string[],
      pageColumns,
      pageCards,
    }

    // Act
    const shown = boardContentForRender(input)

    // Assert
    expect(shown).toEqual({ columns: ['Ideas'], cards: ['gitbox'] })
  })

  // Value: protects=opening one board does not draw the columns the store still has from the board just left; fails_when=the previous board's columns stay on screen; why_new=the store outlives the page; seam=none; no_claim=the scroll to a linked card
  test('the page columns are shown when the store still holds another board', () => {
    // Arrange
    const input = {
      boardId: 'board-1',
      hydratedBoardId: 'board-2',
      storeColumns,
      storeCards,
      pageColumns,
      pageCards,
    }

    // Act
    const shown = boardContentForRender(input)

    // Assert
    expect(shown).toEqual({ columns: ['Ideas'], cards: ['gitbox'] })
  })

  // Value: protects=a drag stays on screen after the store has taken this board over; fails_when=the page data puts the card back; why_new=the store is what a drag writes; seam=none; no_claim=the position write
  test('the store is shown once it holds this board', () => {
    // Arrange
    const input = {
      boardId: 'board-1',
      hydratedBoardId: 'board-1',
      storeColumns,
      storeCards,
      pageColumns,
      pageCards,
    }

    // Act
    const shown = boardContentForRender(input)

    // Assert
    expect(shown).toEqual({ columns: ['In progress'], cards: ['other'] })
  })
})
