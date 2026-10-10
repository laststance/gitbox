import type { RepoCardForRedux } from '@/lib/models/domain'

/** Where one card sits on the board: its column and its position inside it. */
export interface CardColumnPosition {
  /** RepoCard id. */
  id: string
  /** Column (status list) that holds the card. */
  statusId: string
  /** Zero-based position inside that column, top first. */
  order: number
}

/**
 * Reads each card's column and position from the order of the cards array,
 * which is the order the board renders them in.
 *
 * Exists because the `order` field of a card in Redux is only as fresh as the
 * last page load: drags reorder the array and write positions to the database
 * without updating that field. Called by {@link useKanbanUndo} to write an
 * undone layout back and to tell whether an undo changes anything.
 *
 * @param cards - Cards in render order (any mix of columns).
 * @returns One entry per card, in the same order, numbered per column from 0.
 * @example
 * toColumnPositions([cardInTodo, cardInDone, otherCardInTodo])
 * // => [{ id: 'a', statusId: 'todo', order: 0 }, { id: 'b', statusId: 'done', order: 0 }, { id: 'c', statusId: 'todo', order: 1 }]
 */
export const toColumnPositions = (
  cards: RepoCardForRedux[],
): CardColumnPosition[] => {
  const nextOrderByStatusId = new Map<string, number>()

  return cards.map((card) => {
    const order = nextOrderByStatusId.get(card.statusId) ?? 0
    nextOrderByStatusId.set(card.statusId, order + 1)
    return { id: card.id, statusId: card.statusId, order }
  })
}
